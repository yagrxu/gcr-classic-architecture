# GCR Customer Classic Architecure

## Concept

## Deployment

### Prerequistes

1. Install

    ```shell
    npm install -g aws-cdk
    cdk --version
    ```

2. Bootstrap

    ```shell
    # default region set to us-west-2
    cdk bootstrap aws://<accountID>/us-west-2

    ```

### Configuration Setup

``` shell
# configure deploy region, stack name
export AWS_DEFAULT_REGION=us-west-2
export STACK_NAME=test

# credentials
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx

```

### Deploy stacks

``` shell
cdk deploy ${STACK_NAME}-networks --require-approval never
cdk deploy ${STACK_NAME}-storage --require-approval never
cdk deploy ${STACK_NAME}-infra --require-approval never
# migration related resources
cdk deploy ${STACK_NAME}-migration --require-approval never
# AWS basic test related resources
cdk deploy ${STACK_NAME}-test --require-approval never
```
