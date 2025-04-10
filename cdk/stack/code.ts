import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as fs from 'fs'
import * as path from 'path'

export class TestCodeStack extends cdk.Stack {
  constructor (scope: Construct, id: string, props?: any) {
    const suffix = '-test'
    super(scope, id + suffix, props)

    const paramNvm: string = this.node.tryGetContext('nvm')!
    const paramNode: string = this.node.tryGetContext('node')!

    // create a test security group
    const testSecurityGroup = new ec2.SecurityGroup(this, 'TestSecurityGroup', {
      vpc: props.vpc,
      allowAllOutbound: true,
      description: 'Test security group'
    })

    testSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(22),
      'Allow SSH access'
    )

    // create an EIP
    const eip = new ec2.CfnEIP(this, 'TestEIP', {
      domain: 'vpc'
    })

    // create an EC2 instance with profile that can access secret manager
    const profile = new iam.Role(this, 'TestProfile', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      description: 'Test profile',
      inlinePolicies: {
        'secret-manager-policy': new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              actions: ['secretsmanager:GetSecretValue'],
              resources: [props.aosSecretArn],
              effect: iam.Effect.ALLOW
            })
          ]
        })
      }
    })

    const instance = new ec2.Instance(this, 'Instance', {
      vpc: props.vpc,
      instanceName: 'TestCodeInstance',
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC
      },
      role: profile,
      securityGroup: testSecurityGroup,
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.BURSTABLE3,
        ec2.InstanceSize.LARGE
      ),
      // disk
      blockDevices: [
        {
          deviceName: '/dev/xvda',
          volume: ec2.BlockDeviceVolume.ebs(100, {
            encrypted: true,
            deleteOnTermination: true,
            volumeType: ec2.EbsDeviceVolumeType.GP3
          })
        }
      ],
      machineImage: ec2.MachineImage.latestAmazonLinux2023({
        edition: ec2.AmazonLinuxEdition.STANDARD,
        cpuType: ec2.AmazonLinuxCpuType.X86_64
      })
    })

    new ec2.CfnEIPAssociation(this, 'EIPAssociation', {
      eip: eip.ref,
      instanceId: instance.instanceId
    })
    let updateScript = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'update-fluent-bit-config.sh'), 'utf8');
    let fluentBitConfig = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'fluent-bit.conf'), 'utf8');
    const parsersConfig = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'parsers.conf'), 'utf8');

    updateScript = updateScript.replace('{{SECRET_ARN}}', props.secretArn);
    fluentBitConfig = fluentBitConfig.replace('{{OPENSEARCH_URL}}', props.aosEndpoint.replace('https://', ''));

    // add user data install golang, download and start fluentbit to send logs to opensearch
    instance.addUserData(
      'curl https://raw.githubusercontent.com/fluent/fluent-bit/master/install.sh | sh',
      'yum install -y awscli jq',
      
      `cat > /usr/local/bin/update-fluent-bit-config.sh << 'EOF'\n${updateScript}\nEOF`,
      'chmod +x /usr/local/bin/update-fluent-bit-config.sh',

      // Create Fluent Bit config
      `cat > /etc/fluent-bit/fluent-bit.conf << EOF\n${fluentBitConfig}\nEOF`,

      // Create parsers config
      `cat > /etc/fluent-bit/parsers.conf << EOF\n${parsersConfig}\nEOF`,

      // Run the update script
      '/usr/local/bin/update-fluent-bit-config.sh',

      // Start service
      'systemctl enable fluent-bit',
      'systemctl start fluent-bit'
    )
  }
}
