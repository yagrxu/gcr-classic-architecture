export class Constants {
    public static readonly stackName = process.env.STACK_NAME || "gcr-classic-architecture-stack";
    public static readonly CIDR = process.env.CIDR || "10.0.0.0/16";
}