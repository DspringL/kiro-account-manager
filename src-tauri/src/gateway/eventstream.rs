//! AWS EventStream 二进制协议解码器
//!
//! 消息格式：
//! message := totalLen(4) + headersLen(4) + preludeCrc(4) + headers + payload + messageCrc(4)
//!
//! CRC 使用 CRC32 (IEEE)

use std::collections::HashMap;

#[derive(Debug, Clone)]
pub struct EventStreamMessage {
    pub headers: HashMap<String, String>,
    pub payload: Vec<u8>,
}

/// CRC32 (IEEE) 校验
fn crc32(data: &[u8]) -> u32 {
    let mut crc = 0xFFFF_FFFF_u32;
    for &byte in data {
        crc ^= byte as u32;
        for _ in 0..8 {
            let mask = if crc & 1 == 1 { 0xEDB8_8320 } else { 0 };
            crc = (crc >> 1) ^ mask;
        }
    }
    crc ^ 0xFFFF_FFFF
}

const MINIMUM_MESSAGE_LENGTH: usize = 16;

/// 从缓冲区解码单个 EventStream 消息
///
/// 返回：
/// - Ok(Some((message, consumed_bytes))): 成功解码一个消息
/// - Ok(None): 缓冲区数据不足，需要更多数据
/// - Err(error): 解码失败
pub fn decode_message(buffer: &[u8]) -> Result<Option<(EventStreamMessage, usize)>, String> {
    // 检查最小长度
    if buffer.len() < MINIMUM_MESSAGE_LENGTH {
        return Ok(None);
    }

    // 读取总长度
    let total_len = u32::from_be_bytes([buffer[0], buffer[1], buffer[2], buffer[3]]) as usize;

    // 检查是否有完整消息
    if buffer.len() < total_len {
        return Ok(None);
    }

    // 验证消息长度
    if total_len < MINIMUM_MESSAGE_LENGTH {
        return Err(format!(
            "消息长度 {} 小于最小长度 {}",
            total_len, MINIMUM_MESSAGE_LENGTH
        ));
    }

    let msg_bytes = &buffer[..total_len];

    // 读取头部长度
    let headers_len = u32::from_be_bytes([buffer[4], buffer[5], buffer[6], buffer[7]]) as usize;

    // 验证前导 CRC
    let prelude = &msg_bytes[0..8];
    let prelude_crc = u32::from_be_bytes([msg_bytes[8], msg_bytes[9], msg_bytes[10], msg_bytes[11]]);

    let calculated_prelude_crc = crc32(prelude);
    if calculated_prelude_crc != prelude_crc {
        return Err(format!(
            "前导 CRC 校验失败: 期望 {}, 实际 {}",
            prelude_crc, calculated_prelude_crc
        ));
    }

    // 验证消息 CRC
    let msg_crc = u32::from_be_bytes([
        msg_bytes[total_len - 4],
        msg_bytes[total_len - 3],
        msg_bytes[total_len - 2],
        msg_bytes[total_len - 1],
    ]);

    let calculated_msg_crc = crc32(&msg_bytes[0..total_len - 4]);
    if calculated_msg_crc != msg_crc {
        return Err(format!(
            "消息 CRC 校验失败: 期望 {}, 实际 {}",
            msg_crc, calculated_msg_crc
        ));
    }

    // 解析头部
    let headers_start = 12;
    let headers_end = headers_start + headers_len;
    let mut headers = HashMap::new();
    let mut h_offset = headers_start;

    while h_offset < headers_end && h_offset < msg_bytes.len() {
        // 读取 name length
        if h_offset >= msg_bytes.len() {
            break;
        }
        let name_len = msg_bytes[h_offset] as usize;
        h_offset += 1;

        // 读取 name
        if h_offset + name_len > msg_bytes.len() {
            break;
        }
        let name = String::from_utf8_lossy(&msg_bytes[h_offset..h_offset + name_len]).to_string();
        h_offset += name_len;

        // 读取 type (7 = string)
        if h_offset >= msg_bytes.len() {
            break;
        }
        let header_type = msg_bytes[h_offset];
        h_offset += 1;

        if header_type != 7 {
            log::debug!("跳过不支持的头部类型: {}", header_type);
            break;
        }

        // 读取 value length (2 bytes, big-endian)
        if h_offset + 2 > msg_bytes.len() {
            break;
        }
        let val_len = u16::from_be_bytes([msg_bytes[h_offset], msg_bytes[h_offset + 1]]) as usize;
        h_offset += 2;

        // 读取 value
        if h_offset + val_len > msg_bytes.len() {
            break;
        }
        let value = String::from_utf8_lossy(&msg_bytes[h_offset..h_offset + val_len]).to_string();
        h_offset += val_len;

        headers.insert(name, value);
    }

    // 提取 payload
    let payload_start = headers_end;
    let payload_end = total_len - 4;

    if payload_start > payload_end || payload_end > msg_bytes.len() {
        return Err(format!(
            "Payload 边界无效: start={}, end={}, total={}",
            payload_start, payload_end, total_len
        ));
    }

    let payload = msg_bytes[payload_start..payload_end].to_vec();

    Ok(Some((EventStreamMessage { headers, payload }, total_len)))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_crc32() {
        let data = b"hello";
        let crc = crc32(data);
        assert_eq!(crc, 0x3610a686);
    }

    #[test]
    fn test_decode_incomplete() {
        // 只有 8 字节，不足一个完整消息
        let result = decode_message(&[0, 0, 0, 20, 0, 0, 0, 0]);
        assert!(result.is_ok());
        assert!(result.unwrap().is_none());
    }

    #[test]
    fn test_decode_invalid_length() {
        // 消息长度小于最小值
        let result = decode_message(&[0, 0, 0, 10, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
        assert!(result.is_err());
    }
}
