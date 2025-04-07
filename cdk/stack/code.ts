import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'
import * as ec2 from 'aws-cdk-lib/aws-ec2'

export class TestCodeStack extends cdk.Stack {
  constructor (scope: Construct, id: string, props?: any) {
    const suffix = '-test'
    super(scope, id + suffix, props);

    const paramNvm: string = this.node.tryGetContext('nvm')!;
    const paramNode: string = this.node.tryGetContext('node')!;

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
    testSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(8081),
      'Allow HTTP access'
    )

    // create an EIP
    const eip = new ec2.CfnEIP(this, 'TestEIP', {
      domain: 'vpc'
    })
    
    const instance = new ec2.Instance(this, 'Instance', {
      vpc: props.vpc,
      instanceName: 'TestCodeInstance',
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC,
      },

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
    });
    new ec2.CfnEIPAssociation(this, 'EIPAssociation', {
      eip: eip.ref,
      instanceId: instance.instanceId,
    });
    instance.addUserData(
      `#!/bin/bash
sudo rpm --import https://packages.microsoft.com/keys/microsoft.asc
sudo sh -c 'echo -e "[code]\nname=Visual Studio Code\nbaseurl=https://packages.microsoft.com/yumrepos/vscode\nenabled=1\ngpgcheck=1\ngpgkey=https://packages.microsoft.com/keys/microsoft.asc" > /etc/yum.repos.d/vscode.repo'

# https://github.com/amazonlinux/amazon-linux-2023/issues/397
sleep 10

sudo dnf install -y code git
sudo tee /etc/systemd/system/code-server.service <<EOF
[Unit]
Description=Start code server

[Service]
ExecStart=/usr/bin/code serve-web --port 8080 --host 0.0.0.0 --without-connection-token
Restart=always
Type=simple
User=ec2-user

[Install]
WantedBy = multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now code-server

# Install Node.js
sudo -u ec2-user -i <<EOF
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v${paramNvm}/install.sh | bash
source .bashrc
nvm install ${paramNode}
nvm use ${paramNode}
EOF`,
    );
    
  }
}
