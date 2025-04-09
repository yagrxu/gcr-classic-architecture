import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elasticache from 'aws-cdk-lib/aws-elasticache';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as docdb from 'aws-cdk-lib/aws-docdb';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as aws_opensearch from 'aws-cdk-lib/aws-opensearchservice';
import { EbsDeviceVolumeType } from 'aws-cdk-lib/aws-ec2';
import { PolicyStatement, Effect, AnyPrincipal } from 'aws-cdk-lib/aws-iam';

export class StorageStack extends cdk.Stack {

    public aosEnpoint: string;
    public aosSecretArn: string;

    constructor(scope: Construct, id: string, props?: any) {
        const suffix = '-storage';
        super(scope, id + suffix, props);
    
        // create elasticcache for redis
        const vpc = props.vpc;
            
        // Create a security group for the Elasticache cluster
        const cacheSecurityGroup = new ec2.SecurityGroup(this, 'ElasticacheSecurityGroup', {
            vpc,
            description: 'Security group for Elasticache cluster for redis',
        });
        cacheSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(6379), 'Allow Redis access from anywhere');

        // Create a subnet group using the private subnets from the VPC
        const cacheSubnetGroup: elasticache.CfnSubnetGroup = new elasticache.CfnSubnetGroup(this, 'ElasticacheSubnetGroup', {
            description: 'Subnet group for Elasticache cluster for redis',
            subnetIds: vpc.privateSubnets.map((subnet: ec2.ISubnet): string => subnet.subnetId),
        });

        // Create an Elasticache cluster user with password
        const cacheUserSecret = new secretsmanager.Secret(this, 'ElasticacheUserSecret', {
            generateSecretString: {
                secretStringTemplate: JSON.stringify({ username: 'default' }),
                generateStringKey: 'password',
                excludeCharacters: '@%*()_+=`~{}|[]\\:";\'?,./'
            },
        });

        const redisAdmin = new elasticache.CfnUser(this, 'ElasticacheUser', {
            userId: `${id}-elasticache-user`,
            userName: 'default',
            engine: 'redis',
            passwords: [cacheUserSecret.secretValueFromJson('password').unsafeUnwrap()],
            accessString: 'on ~* &* +@all',
        });

        const redisUsergroup = new elasticache.CfnUserGroup(this, 'ElasticacheUserGroup', {
            userGroupId: `${id}-elasticache-user-group`,
            engine: 'redis',
            userIds: [redisAdmin.userId],
        });

        redisUsergroup.addDependency(redisAdmin);

        const redisElasticache = new elasticache.CfnReplicationGroup(this, 'redisElasticache', {
            cacheNodeType: 'cache.t3.medium',
            engine: 'redis',
            multiAzEnabled: true,
            transitEncryptionMode: 'required',
            clusterMode: 'enabled',
            numCacheClusters: 2, 
            userGroupIds: [redisUsergroup.userGroupId],
            engineVersion: '7.0',
            transitEncryptionEnabled: true,
            cacheSubnetGroupName: cacheSubnetGroup.ref,
            securityGroupIds: [cacheSecurityGroup.securityGroupId],
            replicationGroupDescription: 'Redis cluster for demo',
        });
        redisElasticache.addDependency(redisUsergroup);
        redisElasticache.addDependency(cacheSubnetGroup);

        // create RDS mysql
        // Create a new security group for the RDS instance
        const rdsSecurityGroup = new ec2.SecurityGroup(this, 'RDSSecurityGroup', {
            vpc,
            description: 'Security group for the MySQL RDS test instance',
        });

        rdsSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(3306), 'Allow MySQL access from anywhere')

        // Create a MySQL RDS test instance
        const testRdsInstance = new rds.DatabaseInstance(this, 'TestMySQLInstance', {
            engine: rds.DatabaseInstanceEngine.mysql({ version: rds.MysqlEngineVersion.VER_8_0_40 }),
            instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE3, ec2.InstanceSize.LARGE),
            vpc,
            credentials: rds.Credentials.fromGeneratedSecret('admin'),
            allocatedStorage: 20,
            maxAllocatedStorage: 30,
            multiAz: false,
            deletionProtection: false,
            vpcSubnets: {
                subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
            },
            securityGroups: [rdsSecurityGroup],
        });

        // create secret in secret manager for docdb
        const docDBSecret = new secretsmanager.Secret(this, 'DocDBSecret', {
            secretName: 'docdb-credentials',
            generateSecretString: {
                secretStringTemplate: JSON.stringify({ username: 'admin' }),
                requireEachIncludedType: true,
                excludePunctuation: true,
                generateStringKey: 'password'
            },
        });

        

        // create documentdb
        const docDBSecurityGroup = new ec2.SecurityGroup(this, 'DocDBSecurityGroup', {
            vpc,
            description: 'Security group for the DocumentDB test instance',
        });

        docDBSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(27017), 'Allow MongoDB access from anywhere')
        

        // create subnet group for docdb
        const docDBSubnetGroup = new docdb.CfnDBSubnetGroup(this, 'DocDBSubnetGroup', {
            dbSubnetGroupDescription: 'Subnet group for DocumentDB',
            subnetIds: vpc.privateSubnets.map((subnet: ec2.ISubnet): string => subnet.subnetId),
        });
        
        const docDBCluster = new docdb.CfnDBCluster(this, 'TestDocDBCluster', {
            masterUsername: 'mongo',
            masterUserPassword: docDBSecret.secretValueFromJson('password').unsafeUnwrap(),
            engineVersion: '5.0.0',
            storageType: 'iopt1',
            dbSubnetGroupName: docDBSubnetGroup.ref,
            vpcSecurityGroupIds: [docDBSecurityGroup.securityGroupId],
            deletionProtection: false,
        });
        

        new docdb.CfnDBInstance(this, 'DocDBInstance', {
            dbClusterIdentifier: docDBCluster.ref,
            dbInstanceClass: 'db.t4g.medium'
        });

        // generate secret for opensearch
        const opensearchSecret = new secretsmanager.Secret(this, 'OpenSearchSecret', {
            secretName: `${id}-opensearch-log-credentials`,
            generateSecretString: {
                secretStringTemplate: JSON.stringify({ username: 'admin' }),
                generateStringKey: 'password',
                requireEachIncludedType: true,
                // excludePunctuation: true,
            },
        });

        // create security group for opensearch
        const opensearchSecurityGroup = new ec2.SecurityGroup(this, 'OpenSearchSecurityGroup', {
            vpc,
            description: 'Security group for OpenSearch cluster',
        });
        // opensearchSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), 'Allow HTTP access from anywhere');
        opensearchSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443), 'Allow HTTPS access from anywhere');
        // opensearchSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(9200), 'Allow OpenSearch access from anywhere');

        const opensearchCluster = new aws_opensearch.Domain(this, 'Domain', {
            version: aws_opensearch.EngineVersion.openSearch('2.17'),
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            vpc: props.vpc,
            vpcSubnets: [vpc.selectSubnets({ subnets: [vpc.privateSubnets[0]] })],
            securityGroups: [opensearchSecurityGroup],
            domainName: `${id}-aos-log`,
            capacity: {
              dataNodes: 1,
              multiAzWithStandbyEnabled: false,
              dataNodeInstanceType: 'r7g.large.search',
              masterNodes: 0,
            },
            fineGrainedAccessControl: {
              masterUserName: 'admin',
              masterUserPassword: opensearchSecret.secretValueFromJson('password'),
            },
            accessPolicies: [
              new PolicyStatement({
            effect: Effect.ALLOW,
            principals: [new AnyPrincipal()],
            actions: ['es:*'],
            resources: ['*'],
              }),
            ],
            enforceHttps: true,
            zoneAwareness: {
              enabled: false,
            },
            ebs: {
              volumeSize: 100,
              volumeType: EbsDeviceVolumeType.GENERAL_PURPOSE_SSD_GP3
            },
            encryptionAtRest: {
              enabled: true,
            },
            nodeToNodeEncryption: true,
            logging: {
              slowSearchLogEnabled: true,
              appLogEnabled: true,
            }
          });

        // create VPC endpoint for opensearch
        //   vpc.addInterfaceEndpoint('OpenSearchVpcEndpoint', {
        //     service: new ec2.InterfaceVpcEndpointAwsService('es'),
        //     subnets: {
        //       onePerAz: true,
        //       subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        //     },
        //     securityGroups: [opensearchSecurityGroup],
        //   });

        this.aosEnpoint = opensearchCluster.domainEndpoint;
        this.aosSecretArn = opensearchSecret.secretArn;

    }
}

