#!/bin/bash
SECRET_ARN={{SECRET_ARN}}
PASSWORD=$(aws secretsmanager get-secret-value --secret-id "$SECRET_ARN" --query SecretString --output text | jq -r .password)
ESCAPED_PASSWORD=$(printf '%s\n' "$PASSWORD" | sed 's/[&/\]/\\&/g')
sed -i "s|{{OPENSEARCH_PASSWORD}}|$ESCAPED_PASSWORD|g" /etc/fluent-bit/fluent-bit.conf
