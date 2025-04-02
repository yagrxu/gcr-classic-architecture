import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as eks from 'aws-cdk-lib/aws-eks';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
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
    const instance = new ec2.Instance(this, 'Instance', {
      vpc: props.vpc,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE3, ec2.InstanceSize.LARGE),
      machineImage: ec2.MachineImage.latestAmazonLinux2({
        edition: ec2.AmazonLinuxEdition.STANDARD,
        storage: ec2.AmazonLinuxStorage.GENERAL_PURPOSE,
        cpuType: ec2.AmazonLinuxCpuType.X86_64,
        userData: ec2.UserData.custom('#!/bin/bash\ngit clone https://github.com/alibaba/RedisShake\ncd RedisShake\nsh build.sh'),
      }),
    });

  }
}
