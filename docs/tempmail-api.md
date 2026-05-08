# TempMail API 接口文档

本文档描述 Kiro Account Manager 自动注册功能所使用的临时邮箱服务接口。

## 基础信息

| 项目 | 说明 |
|------|------|
| Base URL | `https://your-tempmail-api.example.com` |
| 认证方式 | Admin 接口使用 `x-admin-auth` Header；用户接口使用 `Authorization: Bearer <jwt>` |
| 数据格式 | JSON |

---

## 接口列表

### 1. 创建临时邮箱

**POST** `/admin/new_address`

创建一个新的临时邮箱地址，返回地址信息和访问凭证。

#### 请求 Headers

| Header | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `x-admin-auth` | string | ✅ | Admin 认证密码 |
| `Content-Type` | string | ✅ | 固定值 `application/json` |

#### 请求 Body

```json
{
  "enablePrefix": false,
  "name": "randomstring123"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `enablePrefix` | boolean | ✅ | 是否启用前缀，固定传 `false` |
| `name` | string | ✅ | 邮箱名称（本地部分），12位随机小写字母+数字 |

#### 响应 Body（200 OK）

```json
{
  "address": "randomstring123@your-domain.example.com",
  "jwt": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "address_id": 12345
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `address` | string | 完整邮箱地址，用于注册 AWS 账号 |
| `jwt` | string | 该邮箱的访问令牌，用于后续查询邮件 |
| `address_id` | integer | 邮箱 ID，用于删除邮箱 |

#### 示例

```bash
curl -X POST https://your-tempmail-api.example.com/admin/new_address \
  -H "x-admin-auth: YOUR_ADMIN_PASSWORD" \
  -H "Content-Type: application/json" \
  -d '{"enablePrefix": false, "name": "abc123xyz789"}'
```

---

### 2. 删除临时邮箱

**DELETE** `/admin/delete_address/{address_id}`

注册完成后清理临时邮箱，释放资源。

#### 请求 Headers

| Header | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `x-admin-auth` | string | ✅ | Admin 认证密码 |

#### 路径参数

| 参数 | 类型 | 说明 |
|------|------|------|
| `address_id` | integer | 创建邮箱时返回的 `address_id` |

#### 响应

成功返回 `200 OK`，无响应体（或空 JSON）。

#### 示例

```bash
curl -X DELETE https://your-tempmail-api.example.com/admin/delete_address/12345 \
  -H "x-admin-auth: YOUR_ADMIN_PASSWORD"
```

---

### 3. 查询邮件列表

**GET** `/api/mails?limit=20&offset=0`

轮询收件箱，获取最新邮件列表，用于提取 AWS 验证码。

#### 请求 Headers

| Header | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `Authorization` | string | ✅ | 格式：`Bearer <jwt>`，jwt 来自创建邮箱的响应 |

#### 查询参数

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `limit` | integer | 20 | 每页邮件数量 |
| `offset` | integer | 0 | 分页偏移量 |

#### 响应 Body（200 OK）

```json
{
  "results": [
    {
      "raw": "From: no-reply@signin.aws\r\nSubject: Your verification code\r\n\r\nYour verification code is 123456",
      "source": "no-reply@signin.aws"
    }
  ],
  "count": 1
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `results` | array | 邮件列表 |
| `results[].raw` | string | 邮件原始内容（含 Headers 和 Body），用于正则提取验证码 |
| `results[].source` | string | 发件人地址，用于过滤 AWS 邮件 |
| `count` | integer | 邮件总数 |

#### 验证码提取逻辑

程序通过以下正则依次匹配 `raw` 字段提取 6 位验证码：

```
verification code is[:\s]*(\d{6})
Your code is[:\s]*(\d{6})
code is[:\s]*(\d{6})
>\s*(\d{6})\s*<
\b(\d{6})\b
```

仅处理来自以下发件人的邮件：

- `signin.aws`
- `awsapps.com`
- `amazonses.com`
- `amazon.com`

#### 示例

```bash
curl "https://your-tempmail-api.example.com/api/mails?limit=20&offset=0" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

## 完整调用流程

```
1. POST /admin/new_address          → 获取 address、jwt、address_id
2. 使用 address 注册 AWS 账号
3. GET  /api/mails?limit=20&offset=0  → 轮询验证码（最多10次，每次间隔5s）
4. 完成注册后 DELETE /admin/delete_address/{address_id}  → 清理邮箱
```

---

## 配置说明

在 Kiro Account Manager 的自动注册页面中：

| 配置项 | 对应值 |
|--------|--------|
| API 地址 | `https://your-tempmail-api.example.com` |
| Admin 密码 | `YOUR_ADMIN_PASSWORD` |

> ⚠️ Admin 密码具有创建和删除邮箱的权限，请妥善保管，不要提交到代码仓库。
