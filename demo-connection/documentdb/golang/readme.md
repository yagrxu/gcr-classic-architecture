# MongoDB客户端部署操作手册

## 1. 环境准备

### 1.1 Go环境安装

```bash
# 下载Go安装包（以Linux amd64为例，根据服务器实际情况选择合适的版本）
wget https://go.dev/dl/go1.21.6.linux-amd64.tar.gz

# 解压到/usr/local目录
sudo tar -C /usr/local -xzf go1.21.6.linux-amd64.tar.gz

# 配置环境变量，添加到~/.bashrc或~/.profile
echo 'export PATH=$PATH:/usr/local/go/bin' >> ~/.bashrc
echo 'export GOPATH=$HOME/go' >> ~/.bashrc
source ~/.bashrc

# 验证安装
go version
```

## 2. 代码部署

### 2.1 创建项目目录

```bash
mkdir -p ~/mongodb-client
cd ~/mongodb-client
```

### 2.2 创建Go模块文件

```bash
# 初始化Go模块
go mod init mongodb-client
```

### 2.3 创建MongoDB客户端代码

创建 `mongodb_client.go` 文件，内容如下：

```go
package main

import (
    "context"
    "fmt"
    "log"
    "time"

    "go.mongodb.org/mongo-driver/bson"
    "go.mongodb.org/mongo-driver/bson/primitive"
    "go.mongodb.org/mongo-driver/mongo"
    "go.mongodb.org/mongo-driver/mongo/options"
)

// User 定义用户文档结构
type User struct {
    ID        primitive.ObjectID `bson:"_id,omitempty"`
    Name      string             `bson:"name"`
    Email     string             `bson:"email"`
    Age       int                `bson:"age"`
    CreatedAt time.Time          `bson:"created_at"`
}

func main() {
    // 创建上下文
    ctx := context.Background()

    // 连接到MongoDB
    clientOptions := options.Client().ApplyURI("mongodb://localhost:27017")
    client, err := mongo.Connect(ctx, clientOptions)
    if err != nil {
        log.Fatalf("连接MongoDB失败: %v", err)
    }
    defer client.Disconnect(ctx)

    // 检查连接
    err = client.Ping(ctx, nil)
    if err != nil {
        log.Fatalf("无法连接到MongoDB: %v", err)
    }

    fmt.Println("成功连接到MongoDB!")

    // 获取数据库和集合
    db := client.Database("testdb")
    collection := db.Collection("users")

    // 清空集合，以便演示
    _, err = collection.DeleteMany(ctx, bson.M{})
    if err != nil {
        log.Fatalf("清空集合失败: %v", err)
    }
    fmt.Println("集合已清空，准备演示增删改查操作")

    // 1. 增: 插入单个文档
    user1 := User{
        ID:        primitive.NewObjectID(),
        Name:      "张三",
        Email:     "zhangsan@example.com",
        Age:       30,
        CreatedAt: time.Now(),
    }

    insertResult, err := collection.InsertOne(ctx, user1)
    if err != nil {
        log.Fatalf("插入文档失败: %v", err)
    }
    fmt.Printf("插入的文档ID: %v\n", insertResult.InsertedID)

    // 保存第一个用户的ID，后面会用到
    userID := user1.ID

    // 插入多个文档
    user2 := User{
        ID:        primitive.NewObjectID(),
        Name:      "李四",
        Email:     "lisi@example.com",
        Age:       25,
        CreatedAt: time.Now(),
    }
    user3 := User{
        ID:        primitive.NewObjectID(),
        Name:      "王五",
        Email:     "wangwu@example.com",
        Age:       35,
        CreatedAt: time.Now(),
    }

    users := []interface{}{user2, user3}
    insertManyResult, err := collection.InsertMany(ctx, users)
    if err != nil {
        log.Fatalf("插入多个文档失败: %v", err)
    }
    fmt.Printf("成功插入了%d个文档\n", len(insertManyResult.InsertedIDs))

    // 2. 查: 查询文档
    fmt.Println("\n--- 查询操作 ---")

    // 查询单个文档
    var result User
    err = collection.FindOne(ctx, bson.M{"_id": userID}).Decode(&result)
    if err != nil {
        log.Fatalf("查询文档失败: %v", err)
    }
    fmt.Printf("查询到的文档: %+v\n", result)

    // 查询多个文档
    fmt.Println("\n所有用户:")
    cursor, err := collection.Find(ctx, bson.M{})
    if err != nil {
        log.Fatalf("查询所有文档失败: %v", err)
    }
    defer cursor.Close(ctx)

    var allUsers []User
    if err = cursor.All(ctx, &allUsers); err != nil {
        log.Fatalf("解析查询结果失败: %v", err)
    }

    for i, user := range allUsers {
        fmt.Printf("%d: %s (%s), 年龄: %d\n", i+1, user.Name, user.Email, user.Age)
    }

    // 条件查询
    fmt.Println("\n年龄大于等于30的用户:")
    filter := bson.M{"age": bson.M{"$gte": 30}}
    cursor, err = collection.Find(ctx, filter)
    if err != nil {
        log.Fatalf("条件查询失败: %v", err)
    }
    defer cursor.Close(ctx)

    var olderUsers []User
    if err = cursor.All(ctx, &olderUsers); err != nil {
        log.Fatalf("解析查询结果失败: %v", err)
    }

    for i, user := range olderUsers {
        fmt.Printf("%d: %s (%s), 年龄: %d\n", i+1, user.Name, user.Email, user.Age)
    }

    // 3. 改: 更新文档
    fmt.Println("\n--- 更新操作 ---")

    // 更新单个文档
    update := bson.M{
        "$set": bson.M{
            "name": "张三 (已更新)",
            "age":  31,
        },
    }
    _, err = collection.UpdateOne(ctx, bson.M{"_id": userID}, update)
    if err != nil {
        log.Fatalf("更新文档失败: %v", err)
    }
    fmt.Println("成功更新了文档")

    // 查询更新后的文档
    err = collection.FindOne(ctx, bson.M{"_id": userID}).Decode(&result)
    if err != nil {
        log.Fatalf("查询更新后的文档失败: %v", err)
    }
    fmt.Printf("更新后的文档: %+v\n", result)

    // 更新多个文档
    updateMany := bson.M{
        "$inc": bson.M{"age": 1},
    }
    updateResult, err := collection.UpdateMany(ctx, bson.M{}, updateMany)
    if err != nil {
        log.Fatalf("批量更新文档失败: %v", err)
    }
    fmt.Printf("批量更新: 匹配了 %v 个文档，更新了 %v 个文档\n", updateResult.MatchedCount, updateResult.ModifiedCount)

    // 4. 删: 删除文档
    fmt.Println("\n--- 删除操作 ---")

    // 删除单个文档
    _, err = collection.DeleteOne(ctx, bson.M{"_id": userID})
    if err != nil {
        log.Fatalf("删除文档失败: %v", err)
    }
    fmt.Println("成功删除了文档")

    // 查询所有剩余文档
    fmt.Println("\n删除后剩余的用户:")
    cursor, err = collection.Find(ctx, bson.M{})
    if err != nil {
        log.Fatalf("查询所有文档失败: %v", err)
    }
    defer cursor.Close(ctx)

    var remainingUsers []User
    if err = cursor.All(ctx, &remainingUsers); err != nil {
        log.Fatalf("解析查询结果失败: %v", err)
    }

    for i, user := range remainingUsers {
        fmt.Printf("%d: %s (%s), 年龄: %d\n", i+1, user.Name, user.Email, user.Age)
    }

    // 删除所有文档
    _, err = collection.DeleteMany(ctx, bson.M{})
    if err != nil {
        log.Fatalf("删除所有文档失败: %v", err)
    }
    fmt.Println("\n已删除所有文档")

    fmt.Println("\nMongoDB操作演示完成")
}
```

### 2.4 修改上述文件中MongoDB连接

```go
// 带认证的连接字符串
clientOptions := options.Client().ApplyURI("mongodb://username:password@hostname:port/database")
```

### 2.5 下载依赖并构建

```bash
# 初始化Go模块
go mod init mongodb-client

# 下载依赖（如果遇到网络问题，可以使用国内代理）
go mod tidy

# 或者使用国内代理
GOPROXY=https://goproxy.cn go mod tidy

# 构建可执行文件
go build -o mongodb-client
```

## 3. 运行

### 3.1 基本运行

```bash
# 直接运行
./mongodb-client
```
