import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Constants } from '../lib/const';

export class NetworkStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc;
  
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    const suffix = '-networks';
    super(scope, id + suffix, props);

    this.vpc = new ec2.Vpc(this, 'VPC', {
        vpcName: id + '-vpc',
        ipAddresses: ec2.IpAddresses.cidr(Constants.CIDR),
        maxAzs: 3,
        natGateways: 1,
    });
  }
}
