import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'
import * as ec2 from 'aws-cdk-lib/aws-ec2'

export class MigrationStack extends cdk.Stack {
  constructor (scope: Construct, id: string, props?: any) {
    const suffix = '-migration'
    super(scope, id + suffix, props)

    const vpc = props.vpc;

    const instance = new ec2.Instance(this, 'Instance', {
      instanceName: 'RedisShake',
      vpc: props.vpc,
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.BURSTABLE3,
        ec2.InstanceSize.LARGE
      ),
      // disk
      blockDevices: [{
        deviceName: '/dev/xvda',
        volume: ec2.BlockDeviceVolume.ebs(100, {
          encrypted: true,
          deleteOnTermination: true,
          volumeType: ec2.EbsDeviceVolumeType.GP3,
        }),
      }],
      machineImage: ec2.MachineImage.latestAmazonLinux2({
        edition: ec2.AmazonLinuxEdition.STANDARD,
        storage: ec2.AmazonLinuxStorage.GENERAL_PURPOSE,
        cpuType: ec2.AmazonLinuxCpuType.X86_64,
        userData: ec2.UserData.custom(
          '#!/bin/bash\ngit clone https://github.com/alibaba/RedisShake\ncd RedisShake\nsh build.sh'
        )
      })
    })

    const vpn = new ec2.CfnVPNGateway(this, 'VPN', {
      type: 'ipsec.1',
      amazonSideAsn: 65000,
    })

    const vpnAttachment = new ec2.CfnVPCGatewayAttachment(this, 'VPNAttachment', {
      vpcId: vpc.vpcId,
      vpnGatewayId: vpn.ref,
    });
  }
}
