import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Constants } from '../lib/const';

export class NetworkStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    const suffix = '-networks';
    super(scope, id + suffix, props);

    const useThreeAzs = true;
    const privateSubnets = 2;
    const azCount = Constants.AZ_COUNT;

    // CDK will not manage NAT for us; we handle it manually
    const vpc = new ec2.Vpc(this, 'VPC', {
      vpcName: id + '-vpc',
      ipAddresses: ec2.IpAddresses.cidr(Constants.CIDR),
      maxAzs: azCount,
      natGateways: 0,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'public',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: 'private-1a',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
        {
          cidrMask: 24,
          name: 'private-2a',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,

        }
      ],
    });

    // Create public route table
    const publicRouteTable = new ec2.CfnRouteTable(this, 'PublicRouteTable', {
      vpcId: vpc.vpcId,
      tags: [{ key: 'Name', value: id + '-public-route-table' }],
    });

    
    // Create private route table
    const privateRouteTable = new ec2.CfnRouteTable(this, 'PrivateRouteTable', {
      vpcId: vpc.vpcId,
      tags: [{ key: 'Name', value: id + '-private-route-table' }],
    });

    if (Constants.NAT_GATEWAY_ENABLED) {
      // Create an Elastic IP for NAT
      const natEip = new ec2.CfnEIP(this, 'NATEIP', {
        domain: 'vpc',
      });

      // Create NAT Gateway in the first public subnet
      const natGateway = new ec2.CfnNatGateway(this, 'NATGateway', {
        subnetId: vpc.publicSubnets[0].subnetId,
        allocationId: natEip.attrAllocationId,
        connectivityType: 'public',
      });

      publicRouteTable.addDependency(natGateway);
      privateRouteTable.addDependency(natGateway);

      new ec2.CfnRoute(this, 'PrivateDefaultRoute', {
        routeTableId: privateRouteTable.ref,
        destinationCidrBlock: '0.0.0.0/0',
        natGatewayId: natGateway.ref,
      });
    }
      
    

    // Add default route to public route table for Internet Gateway
    new ec2.CfnRoute(this, 'PublicDefaultRoute', {
      routeTableId: publicRouteTable.ref,
      destinationCidrBlock: '0.0.0.0/0',
      gatewayId: vpc.internetGatewayId!,
    });

    // Associate each public subnet with the public route table
    for (let i = 0; i < vpc.publicSubnets.length; i++) {
      const assoc = new ec2.CfnSubnetRouteTableAssociation(this, `PublicSubnetAssoc${i}`, {
        subnetId: vpc.publicSubnets[i].subnetId,
        routeTableId: publicRouteTable.ref,
      });
      assoc.addDependency(publicRouteTable);
      assoc.addDependency(vpc.publicSubnets[i].node.defaultChild as ec2.CfnSubnet);

    }

    // Associate each private subnet with the private route table
    for (let i = 0; i < (privateSubnets * azCount); i++) {
      const assoc = new ec2.CfnSubnetRouteTableAssociation(this, `PrivateSubnetAssoc${i}`, {
        subnetId: vpc.privateSubnets[i].subnetId,
        routeTableId: privateRouteTable.ref,
      });
      assoc.addDependency(privateRouteTable);
      assoc.addDependency(vpc.privateSubnets[i].node.defaultChild as ec2.CfnSubnet);
    }

    // Set exported VPC
    this.vpc = vpc;
  }
}
