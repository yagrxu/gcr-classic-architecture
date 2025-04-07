import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
// import * as eks from 'aws-cdk-lib/aws-eks';
// import * as ec2 from 'aws-cdk-lib/aws-ec2';
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class InfraStack extends cdk.Stack {
  
  constructor(scope: Construct, id: string, props?: any) {
    const suffix = '-infra';
    super(scope, id + suffix, props);

    // The code that defines your stack goes here

    // create EKS cluster
    // const cluster = new eks.Cluster(this, 'Cluster', {
    //   defaultCapacityInstance: new ec2.InstanceType('t3.large'),
    //   version: eks.KubernetesVersion.V1_31,
    //   vpc: props.vpc,
    //   defaultCapacity: 2,
    // });

    // create ec2 instance
    
  }
}
