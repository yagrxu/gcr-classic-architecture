import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Constants } from '../lib/const';

export class NetworkStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    const suffix = '-networks';
    super(scope, id + suffix, props);

    // Create VPC with no subnets; subnets will be added manually.
    const vpc = new ec2.Vpc(this, 'VPC', {
      vpcName: id + '-vpc',
      ipAddresses: ec2.IpAddresses.cidr(Constants.CIDR),
      maxAzs: 3,
      natGateways: 1,
      subnetConfiguration: [] // disable automatic subnet creation
    });

    const azs = cdk.Stack.of(this).availabilityZones; // get available AZs

    // Define how many pairs to create
    const publicPairCount = 2;         // Number of public subnets (one per AZ)
    const privatePairCount = 2;        // Each pair will create 2 private subnets (total 4)

    // Create public subnets and store them in an array.
    const publicSubnets: ec2.PublicSubnet[] = [];
    const azArray = ['a', 'b']
    
    for (let i = 0; i < publicPairCount; i++) {
      // Use Fn.cidr with a split based on the number of public subnets.
      const subnet = new ec2.PublicSubnet(this, `PublicSubnet${i + 1}${azArray[i]}`, {
        vpcId: vpc.vpcId,
        availabilityZone: azs[i],
        cidrBlock: cdk.Fn.select(i, cdk.Fn.cidr(Constants.CIDR, publicPairCount, '0')),
      });
      publicSubnets.push(subnet);
    }

    // Create private subnets in pairs and store them in an array.
    const privateSubnets: ec2.PrivateSubnet[] = [];
    // We'll generate 2 subnets per pair (e.g. for two different AZs)
    for (let i = 0; i < privatePairCount; i++) {
      // First private subnet in the pair (in AZ0)
      const subnetA = new ec2.PrivateSubnet(this, `PrivateSubnet${i + 1}a`, {
        vpcId: vpc.vpcId,
        availabilityZone: azs[0],
        // We split the CIDR into privatePairCount*2 blocks.
        cidrBlock: cdk.Fn.select(i * 2, cdk.Fn.cidr(Constants.CIDR, privatePairCount * 2, '1')),
      });
      privateSubnets.push(subnetA);

      // Second private subnet in the pair (in AZ1)
      const subnetB = new ec2.PrivateSubnet(this, `PrivateSubnet${i + 1}b`, {
        vpcId: vpc.vpcId,
        availabilityZone: azs[1],
        cidrBlock: cdk.Fn.select(i * 2 + 1, cdk.Fn.cidr(Constants.CIDR, privatePairCount * 2, '1')),
      });
      privateSubnets.push(subnetB);
    }

    // Create a single public route table and associate it with all public subnets.
    const publicRouteTable = new ec2.CfnRouteTable(this, 'PublicRouteTable', {
      vpcId: vpc.vpcId,
      tags: [{ key: 'Name', value: id + '-public-route-table' }],
    });
    publicSubnets.forEach((subnet, index) => {
      new ec2.CfnSubnetRouteTableAssociation(this, `PublicSubnetAssociation${index + 1}`, {
        subnetId: subnet.subnetId,
        routeTableId: publicRouteTable.ref,
      });
    });

    // Create a single private route table and associate it with all private subnets.
    const privateRouteTable = new ec2.CfnRouteTable(this, 'PrivateRouteTable', {
      vpcId: vpc.vpcId,
      tags: [{ key: 'Name', value: id + '-private-route-table' }],
    });
    privateSubnets.forEach((subnet, index) => {
      new ec2.CfnSubnetRouteTableAssociation(this, `PrivateSubnetAssociation${index + 1}`, {
        subnetId: subnet.subnetId,
        routeTableId: privateRouteTable.ref,
      });
    });

    // Set the vpc property.
    this.vpc = vpc;

    // Additional code (e.g., VPN creation) can follow here.
  }
}
