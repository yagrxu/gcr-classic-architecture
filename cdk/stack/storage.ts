import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elasticache from 'aws-cdk-lib/aws-elasticache';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as docdb from 'aws-cdk-lib/aws-docdb';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';

export class StorageStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: any) {
        const suffix = '-storage';
        super(scope, id + suffix, props);
    
        // create elasticcache for valkey
        const vpc = props.vpc;
            
        // Create a security group for the Elasticache cluster
        const cacheSecurityGroup = new ec2.SecurityGroup(this, 'ElasticacheSecurityGroup', {
            vpc,
            description: 'Security group for Elasticache cluster for valkey',
        });

        // Create a subnet group using the private subnets from the VPC
        const cacheSubnetGroup: elasticache.CfnSubnetGroup = new elasticache.CfnSubnetGroup(this, 'ElasticacheSubnetGroup', {
            description: 'Subnet group for Elasticache cluster for valkey',
            subnetIds: vpc.privateSubnets.map((subnet: ec2.ISubnet): string => subnet.subnetId),
        });

        // Create an Elasticache cluster (using Redis in this example) for valkey
        const redisElasticache = new elasticache.CfnCacheCluster(this, 'redisElasticache', {
            cacheNodeType: 'cache.t3.medium',
            engine: 'redis',
            numCacheNodes: 1,
            clusterName: 'redis',
            vpcSecurityGroupIds: [cacheSecurityGroup.securityGroupId],
            cacheSubnetGroupName: cacheSubnetGroup.ref,
        });

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
                generateStringKey: 'password',
                excludePunctuation: true,
            },
        });
        

        // create documentdb
        const docDBSecurityGroup = new ec2.SecurityGroup(this, 'DocDBSecurityGroup', {
            vpc,
            description: 'Security group for the DocumentDB test instance',
        });

        docDBSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(27017), 'Allow MongoDB access from anywhere')
        
        new docdb.DatabaseCluster(this, 'TestDocDBCluster', {
            masterUser: {
                username: 'mongo',
                password: docDBSecret.secretValueFromJson('password'),
            },
            engineVersion: '5.0.0',

            instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.MEDIUM),
            vpc,
            vpcSubnets: {
                subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
            },
            securityGroup: docDBSecurityGroup,
            deletionProtection: false,
            storageType: docdb.StorageType.IOPT1,
        });
    }
}

