const validation = {
  validation: {
    connectionRequest: {
      serverId: {
        required: 'Missing server ID.'
      }
    },
    credential: {
      name: {
        max: 'Credential name must be 80 characters or fewer.',
        required: 'Enter a credential name.'
      },
      note: {
        max: 'Notes must be 400 characters or fewer.'
      },
      password: {
        required: 'A password is required for password-type credentials.'
      },
      privateKey: {
        required: 'Private key content is required for private key credentials.'
      },
      username: {
        max: 'Username must be 64 characters or fewer.'
      }
    },
    portForward: {
      host: {
        max: 'Host is too long.',
        required: 'Enter a host.'
      },
      port: {
        max: 'Port must be 65535 or lower.',
        min: 'Port must be at least 1.'
      }
    },
    proxy: {
      host: {
        max: 'Proxy host is too long.',
        required: 'Enter a proxy host.'
      },
      port: {
        max: 'Proxy port must be 65535 or lower.',
        min: 'Proxy port must be at least 1.'
      }
    },
    group: {
      name: {
        max: 'Group name must be 40 characters or fewer.',
        required: 'Enter a group name.'
      }
    },
    server: {
      customIcon: {
        invalid: 'The server icon payload is invalid.',
        required: 'A server icon upload must include both the image type and binary data.',
        size: 'The server icon must be 256 KB or smaller.'
      },
      host: {
        max: 'Host is too long.',
        required: 'Enter a host.'
      },
      jumpServer: {
        self: 'A server cannot use itself as its jump server.'
      },
      name: {
        max: 'Server name must be 60 characters or fewer.',
        required: 'Enter a server name.'
      },
      note: {
        max: 'Notes must be 400 characters or fewer.'
      },
      port: {
        max: 'Port must be 65535 or lower.',
        min: 'Port must be at least 1.'
      },
      privateKey: {
        required:
          'Private key content is required for key-based authentication, or select an existing credential.'
      },
      username: {
        max: 'Username must be 64 characters or fewer.',
        required: 'Enter a username.'
      }
    },
    tag: {
      name: {
        max: 'Tag name must be 32 characters or fewer.',
        required: 'Enter a tag name.'
      }
    },
    customCommand: {
      name: {
        max: 'Command alias must be 60 characters or fewer.',
        required: 'Enter a command alias.'
      },
      command: {
        max: 'Shell command must be 2000 characters or fewer.',
        required: 'Enter a shell command.'
      }
    }
  }
}

export default validation
