#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { InfraStack } from '../stack/infra';
import { NetworkStack } from '../stack/network';
import { StorageStack } from '../stack/storage';
import { Constants } from '../lib/const';

const app = new cdk.App();
const stackName = Constants.stackName;
const networkStack = new NetworkStack(app, stackName, {});
const storageStack = new StorageStack(app, stackName, {
  vpc: networkStack.vpc} as any);
const infraStack = new InfraStack(app, stackName, {
  vpc: networkStack.vpc} as any);

infraStack.addDependency(networkStack);
storageStack.addDependency(networkStack);