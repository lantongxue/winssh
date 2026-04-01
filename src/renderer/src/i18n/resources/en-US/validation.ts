const validation = {
  validation: {
    connectionRequest: {
      serverId: {
        required: 'Missing server ID.'
      }
    },
    group: {
      name: {
        max: 'Group name must be 40 characters or fewer.',
        required: 'Enter a group name.'
      }
    },
    server: {
      host: {
        max: 'Host is too long.',
        required: 'Enter a host.'
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
      privateKeyPath: {
        required: 'A private key file is required for key-based authentication.'
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
    }
  }
}

export default validation
