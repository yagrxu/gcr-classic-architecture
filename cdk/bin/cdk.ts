#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { InfraStack } from '../stack/infra';
import { NetworkStack } from '../stack/network';
import { StorageStack } from '../stack/storage';
import { Constants } from '../lib/const';
import { MigrationStack } from '../stack/migration';
import { TestCodeStack } from '../stack/code';

const app = new cdk.App();
const stackName = Constants.stackName;
const networkStack = new NetworkStack(app, stackName, {});
const storageStack = new StorageStack(app, stackName, {
  vpc: networkStack.vpc} as any);
const infraStack = new InfraStack(app, stackName, {
  vpc: networkStack.vpc} as any);

const migrationStack = new MigrationStack(app, stackName, {
  vpc: networkStack.vpc} as any);

const codeStack = new TestCodeStack(app, stackName, {
  vpc: networkStack.vpc} as any);

// Add dependencies between stacks
migrationStack.addDependency(networkStack);
migrationStack.addDependency(storageStack);
migrationStack.addDependency(infraStack);

codeStack.addDependency(networkStack);
codeStack.addDependency(storageStack);
codeStack.addDependency(infraStack);

infraStack.addDependency(networkStack);
storageStack.addDependency(networkStack);