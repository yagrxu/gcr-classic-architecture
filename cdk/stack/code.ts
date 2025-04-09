import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as iam from 'aws-cdk-lib/aws-iam'

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
    // add user data install golang, download and start fluentbit to send logs to opensearch
    instance.addUserData(
      'curl https://raw.githubusercontent.com/fluent/fluent-bit/master/install.sh | sh',
      'yum install -y awscli jq',
      'cat > /usr/local/bin/update-fluent-bit-config.sh << EOF',
      '#!/bin/bash',
      `SECRET_ARN="${props.aosSecretArn}"`,
      'PASSWORD=$(aws secretsmanager get-secret-value --secret-id "$SECRET_ARN" --query SecretString --output text | jq -r .password)',
      'sed -i "s|HTTP_Passwd.*|HTTP_Passwd        $PASSWORD|" /etc/fluent-bit/fluent-bit.conf',
      'systemctl restart fluent-bit',
      'EOF',
      'chmod +x /usr/local/bin/update-fluent-bit-config.sh',

      'cat > /etc/fluent-bit/fluent-bit.conf << EOF\n' +
        '[SERVICE]\n' +
        '    Flush        5\n' +
        '    Daemon       Off\n' +
        '    Log_Level    debug\n' +
        '    Parsers_File parsers.conf\n' +
        '\n' +
        '[INPUT]\n' +
        '    Name           tail\n' +
        '    Path           /var/log/*.log\n' +
        '    Parser         json\n' +
        '    Tag            logs\n' +
        '\n' +
        '[FILTER]\n' +
        '    Name          record_modifier\n' +
        '    Match         *\n' +
        '    Record        hostname ${HOSTNAME}\n' +
        '    Record        environment prod\n' +
        '\n' +
        '[OUTPUT]\n' +
        '    Name               es\n' +
        '    Match              *\n' +
        `    Host               ${props.aosEndpoint.replace(
          'https://',
          ''
        )}\n` +
        '    Port               443\n' +
        '    HTTP_User          admin\n' +
        `    HTTP_Passwd        ${props.aosSecretArn}\n` +
        '    AWS_Region         us-west-2\n' +
        '    TLS               On\n' +
        '    TLS.verify        Off\n' +
        '    Logstash_Format   On\n' +
        '    Logstash_Prefix   logs\n' +
        '    Logstash_DateFormat %Y.%m.%d\n' +
        '    Generate_ID       On\n' +
        '    Write_Operation   create\n' +
        '    Buffer_Size       5MB\n' +
        '    Trace_Error      On\n' +
        '    Trace_Output     On\n' +
        '    Suppress_Type_Name On\n' +
        'EOF',

      'cat > /etc/fluent-bit/parsers.conf << EOF\n' +
        '[PARSER]\n' +
        '    Name         json\n' +
        '    Format       json\n' +
        '    Time_Key     timestamp\n' +
        '    Time_Format  %Y-%m-%dT%H:%M:%S.%L\n' +
        '    Time_Keep    On\n' +
        '    Time_Offset  +0000\n' +
        'EOF',

      '/usr/local/bin/update-fluent-bit-config.sh',

      // Start service
      'systemctl enable fluent-bit',
      'systemctl start fluent-bit'
    )
  }
}
