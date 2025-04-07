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

    // create vpn

    // const vpnRoute = new ec2.CfnVPNConnectionRoute(this, 'VPNRoute', {
    //   destinationCidrBlock: Constants.CIDR,
    //   vpnConnectionId: vpnAttachment.ref,
    // });
    // const vpnRouteTable = new ec2.CfnRouteTable(this, 'VPNRouteTable', {
    //   vpcId: this.vpc.vpcId,
    //   tags: [{
    //     key: 'Name',
    //     value: id + '-vpn-route-table',
    //   }],
    // });
  
  }
}
