#!/bin/bash
SECRET_ARN={{SECRET_ARN}}
PASSWORD=$(aws secretsmanager get-secret-value --secret-id "$SECRET_ARN" --query SecretString --output text | jq -r .password)
sed -i "s|{{OPENSEARCH_PASSWORD}}|$PASSWORD|g" /etc/fluent-bit/fluent-bit.conf

systemctl restart fluent-bit