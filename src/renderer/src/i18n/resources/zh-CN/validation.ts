const validation = {
  validation: {
    connectionRequest: {
      serverId: {
        required: '缺少服务器 ID。'
      }
    },
    portForward: {
      host: {
        max: '主机地址过长。',
        required: '请输入主机地址。'
      },
      port: {
        max: '端口最大为 65535。',
        min: '端口最小为 1。'
      }
    },
    group: {
      name: {
        max: '分组名称不能超过 40 个字符。',
        required: '请输入分组名称。'
      }
    },
    server: {
      host: {
        max: '主机地址过长。',
        required: '请输入主机地址。'
      },
      name: {
        max: '服务器名称不能超过 60 个字符。',
        required: '请输入服务器名称。'
      },
      note: {
        max: '备注不能超过 400 个字符。'
      },
      port: {
        max: '端口最大为 65535。',
        min: '端口最小为 1。'
      },
      privateKey: {
        required: '私钥认证需要填写或导入私钥内容。'
      },
      username: {
        max: '用户名不能超过 64 个字符。',
        required: '请输入用户名。'
      }
    },
    tag: {
      name: {
        max: '标签名称不能超过 32 个字符。',
        required: '请输入标签名称。'
      }
    }
  }
}

export default validation
