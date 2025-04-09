# 测试代码详解

前提： 配置一台amazon linux 2023服务器，并且确保和redis之间的连接是通的

下面是详细的步骤：

## 在 Amazon Linux 2023 安装 Golang

首先，SSH连接到你的服务器，然后执行以下命令：

- 更新系统包

    ```shell
    sudo dnf update -y
    ```

- 安装 Golang

    ```shell
    sudo dnf install golang -y
    ```

- 验证Go安装

    ```shell
    go version
    ```

## 传输代码到服务器

你可以使用SCP或SFTP将本地的redis_client.go文件传输到服务器：

- 在服务器上执行

    ```shell
    mkdir -p ~/redis-app
    cd ~/redis-app

    cat > redis_client.go << 'EOF'
    package main

    import (
        "context"
        "fmt"
        "time"

        "github.com/go-redis/redis/v8"
    )

    func main() {
        ctx := context.Background()

        // 连接到Redis cluster服务器（请根据需要修改Addr和Password）
        client := redis.NewClusterClient(&redis.ClusterOptions{
        Addrs:        []string{"cluster-configuration-endpoint:6379"},
        Password:     "password",
        PoolSize:     10, 
        MinIdleConns: 10,

        DialTimeout:  5 * time.Second,
        ReadTimeout:  3 * time.Second,
        WriteTimeout: 3 * time.Second,
        PoolTimeout:  4 * time.Second,

        IdleCheckFrequency: 60 * time.Second,
        IdleTimeout:        5 * time.Minute,
        MaxConnAge:         0 * time.Second,

        MaxRetries:      10,
        MinRetryBackoff: 8 * time.Millisecond,
        MaxRetryBackoff: 512 * time.Millisecond,

        TLSConfig: &tls.Config{
            InsecureSkipVerify: true,
        },

        ReadOnly:       false,
        RouteRandomly:  false,
        RouteByLatency: false,
    })

        // 测试连接
        if err := client.Ping(ctx).Err(); err != nil {
            fmt.Printf("连接Redis失败: %v\n", err)
            return
        }
        fmt.Println("连接Redis成功!")

        // 增：设置键值对
        if err := client.Set(ctx, "key1", "Hello Redis", 0).Err(); err != nil {
            fmt.Printf("设置键值对失败: %v\n", err)
            return
        }
        fmt.Println("成功设置 key1 = Hello Redis")

        // 查：获取键值
        val, err := client.Get(ctx, "key1").Result()
        if err != nil {
            fmt.Printf("获取键值失败: %v\n", err)
        } else {
            fmt.Printf("key1 的值为: %v\n", val)
        }

        // 改：更新键值
        if err := client.Set(ctx, "key1", "Hello Redis Updated", 0).Err(); err != nil {
            fmt.Printf("更新键值对失败: %v\n", err)
        } else {
            fmt.Println("成功更新 key1 = Hello Redis Updated")
        }

        // 再次查询确认更新
        val, err = client.Get(ctx, "key1").Result()
        if err != nil {
            fmt.Printf("获取更新后的键值失败: %v\n", err)
        } else {
            fmt.Printf("更新后 key1 的值为: %v\n", val)
        }

        // 设置带过期时间的键值对
        if err := client.SetEX(ctx, "key2", "将在5秒后过期", 5*time.Second).Err(); err != nil {
            fmt.Printf("设置带过期时间的键值对失败: %v\n", err)
        } else {
            fmt.Println("成功设置 key2 = 将在5秒后过期 (5秒后过期)")
        }

        // 查询key2
        val, err = client.Get(ctx, "key2").Result()

        }



        // 改：更新键值

        _, err = conn.Do("SET", "key1", "Hello Redis Updated")

        if err != nil {

            fmt.Printf("更新键值对失败: %v\n", err)

        } else {

            fmt.Println("成功更新 key1 = Hello Redis Updated")

        }



        // 再次查询确认更新

        val, err = redis.String(conn.Do("GET", "key1"))

        if err != nil {

            fmt.Printf("获取更新后的键值失败: %v\n", err)

        } else {

            fmt.Printf("更新后 key1 的值为: %v\n", val)

        }



        // 设置带过期时间的键值对

        _, err = conn.Do("SETEX", "key2", 5, "将在5秒后过期")

        if err != nil {

            fmt.Printf("设置带过期时间的键值对失败: %v\n", err)

        } else {

            fmt.Println("成功设置 key2 = 将在5秒后过期 (5秒后过期)")

        }



        // 查询key2

        val, err = redis.String(conn.Do("GET", "key2"))

        if err != nil {

            fmt.Printf("获取key2失败: %v\n", err)

        } else {

            fmt.Printf("key2 的值为: %v\n", val)

        }



        // 删：删除键

        delCount, err := redis.Int(conn.Do("DEL", "key1"))

        if err != nil {

            fmt.Printf("删除键失败: %v\n", err)

        } else {

            fmt.Printf("成功删除了 %v 个键\n", delCount)

        }



        // 确认删除

        exists, err := redis.Bool(conn.Do("EXISTS", "key1"))

        if err != nil {

            fmt.Printf("检查key1是否存在时出错: %v\n", err)

        } else if !exists {

            fmt.Println("key1 已被删除，不存在")

        }



        fmt.Println("等待5秒查看key2是否过期...")

        time.Sleep(time.Second * 5)



        // 检查key2是否过期

        exists, err = redis.Bool(conn.Do("EXISTS", "key2"))

        if err != nil {

            fmt.Printf("检查key2是否存在时出错: %v\n", err)

        } else if !exists {

            fmt.Println("key2 已过期，不存在")

        } else {

            fmt.Println("key2 仍然存在")

        }



        fmt.Println("Redis操作演示完成")

    }

    EOF
    ```

## 初始化 Golang 模块并安装依赖

在服务器上执行以下命令：

cd ~/redis-app

- 初始化Go模块

    ``` shell
    go mod init redis-app
    ```

- 安装redigo依赖

    ``` shell
    go get github.com/gomodule/redigo/redis
    ```

## 修改redis地址

请将代码中的localhost改成redis集群地址

## 编译和运行程序

``` shell
cd ~/redis-app

# 编译程序
go build -o redis-client redis_client.go

# 运行程序
./redis-client
```

## 安全注意事项

在生产环境中，你可能需要：

• 为Redis设置密码

• 配置Redis只监听内部网络接口

• 使用TLS加密连接

• 设置适当的防火墙规则

如果需要设置Redis密码，可以修改代码：

``` golang
// 带密码连接Redis
conn, err := redis.Dial("tcp", "localhost:6379", redis.DialPassword("your-password"))
```