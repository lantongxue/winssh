const workbench = {
  workbench: {
    activity: {
      explorer: {
        description: 'Browse saved hosts, groups, tags, and recent connections.',
        title: 'Explorer'
      },
      settings: {
        description: 'Adjust appearance, terminal behavior, and trust settings.',
        title: 'Settings'
      },
      terminal: {
        description: 'Inspect active SSH sessions and remote file systems.',
        title: 'Terminal'
      }
    },
    commandCenter: {
      commandPalette: {
        description: 'Search WinSSH commands',
        empty: 'No matching commands.',
        groups: {
          currentServer: 'Current Server',
          currentSession: 'Current Session',
          layout: 'Layout',
          theme: 'Theme',
          workbench: 'Workbench'
        },
        placeholder: 'Type a command',
        title: 'Command Palette'
      },
      quickOpen: {
        actions: {
          connectTo: 'Connect to {{target}}'
        },
        description: 'Connect to a server quickly, or jump to a session or settings editor',
        empty: 'No matching items.',
        groups: {
          connections: 'Connections',
          quickConnect: 'Quick Connect',
          sessions: 'Sessions',
          workbench: 'Workbench'
        },
        placeholder: 'Type ssh user@host, or jump to a saved item',
        title: 'Quick Connect'
      }
    },
    documents: {
      serverEditor: {
        newConnection: 'Untitled Connection'
      },
      settings: 'Settings',
      terminal: 'Terminal',
      terminalWelcome: 'Terminal'
    },
    editorTabs: {
      actions: {
        cloneSession: 'Clone Session',
        closeTab: 'Close Tab',
        renameTab: 'Rename Tab'
      },
      dialogs: {
        renameSession: {
          description:
            'Set a temporary title for "{{name}}". It only applies to the current tab and is not saved.',
          placeholder: 'Enter a tab name',
          title: 'Rename Tab'
        }
      }
    },
    explorerHome: {
      actions: {
        clearRecent: 'Clear',
        focusExplorer: 'Back to Explorer',
        focusTerminal: 'Focus Terminal'
      },
      empty: {
        favorites: 'No favorite connections yet.',
        recent: 'No recent connections yet.'
      },
      overview: {
        activeSessions: 'Active Sessions',
        recentConnections: 'Recent Connections',
        savedConnections: 'Saved Connections',
        title: 'Workspace Overview'
      },
      quickLinks: {
        title: 'Quick Links'
      },
      recent: {
        title: 'Recent Connections'
      },
      subtitle:
        'Manage all SSH workflows through Explorer, editor tabs, and the integrated terminal.',
      title: 'WinSSH Workbench',
      favorites: {
        title: 'Favorite Connections'
      },
      toasts: {
        recentCleared: 'Recent connections cleared.'
      }
    },
    panel: {
      clearProblems: 'Clear Problems',
      clearTransfers: 'Clear Transfers',
      empty: {
        output: 'Connection logs and workbench output appear here.',
        problems: 'No workbench-level issues right now.',
        transfers: 'No transfers yet.'
      },
      labels: {
        output: 'Output',
        problems: 'Problems',
        transfers: 'Transfers'
      },
      severities: {
        error: 'Error',
        warning: 'Warning'
      },
      transfer: {
        completed: 'Completed',
        download: 'Download',
        error: 'Error',
        running: 'Running',
        unknown: 'Unknown',
        upload: 'Upload'
      }
    },
    primarySidebar: {
      actions: {
        addToFavorites: 'Add to Favorites',
        clearRecent: 'Clear Recent Connections',
        connect: 'Connect',
        createGroup: 'New Group',
        createTag: 'New Tag',
        edit: 'Edit',
        removeFromFavorites: 'Remove from Favorites',
        rename: 'Rename'
      },
      description: 'Single-click to open the editor, double-click to start an SSH session.',
      dialogs: {
        deleteServer: {
          description:
            'This permanently deletes the saved configuration for "{{name}}" and any stored password or private key passphrase. This action cannot be undone.',
          title: 'Delete Server'
        }
      },
      sections: {
        allServers: 'All Servers',
        favorites: 'Favorites',
        groups: 'Groups',
        recent: 'Recent',
        tags: 'Tags'
      },
      title: 'Explorer',
      toasts: {
        groupDeleted: 'Group deleted.',
        recentCleared: 'Recent connections cleared.',
        serverDeleteFailed: 'Failed to delete the server.',
        tagDeleted: 'Tag deleted.'
      }
    },
    quickInput: {
      credentials: {
        descriptions: {
          passphrase:
            'Enter the passphrase to continue connecting to {{name}}, if the private key uses one.',
          password: 'Enter the password to continue connecting to {{name}}.'
        },
        emptyPassword: 'Password is required.',
        keychainDescription: 'Reuse it automatically on future connections.',
        keychainTitle: 'Store in system keychain',
        placeholder: {
          passphrase: 'Optional, leave empty if there is no passphrase',
          password: 'Enter the server password'
        },
        secretLabel: 'Secret',
        titles: {
          passphrase: 'Enter Private Key Passphrase',
          password: 'Enter Connection Password'
        }
      },
      entity: {
        descriptions: {
          create: 'Use a lightweight input flow to maintain Explorer structure quickly.',
          rename: 'Use a lightweight input flow to maintain Explorer structure quickly.'
        },
        placeholders: {
          group: 'Production',
          tag: 'MySQL'
        },
        titles: {
          createGroup: 'New Group',
          createTag: 'New Tag',
          renameGroup: 'Rename Group',
          renameTag: 'Rename Tag'
        }
      },
      toasts: {
        groupCreated: 'Group created.',
        groupUpdated: 'Group updated.',
        saveFailed: 'Save failed.',
        tagCreated: 'Tag created.',
        tagUpdated: 'Tag updated.'
      }
    },
    serverEditor: {
      actions: {
        hideSecret: 'Hide secret',
        showSecret: 'Show secret'
      },
      auth: {
        password: 'Password',
        privateKey: 'Private Key'
      },
      descriptions: {
        existing: '{{username}}@{{host}}:{{port}}',
        new: 'New SSH connection'
      },
      empty: {
        tags: 'No tags yet. Create one in Explorer.'
      },
      fields: {
        authType: 'Authentication',
        connectNote: 'Connection Notes',
        credential: 'Use Credential',
        credentials: 'Credentials',
        favoriteDescription: 'Favorited servers are prioritized in Explorer.',
        favoriteTitle: 'Favorite this server',
        group: 'Group',
        host: 'Host',
        name: 'Name',
        note: 'Notes',
        password: 'Password',
        passphrase: 'Passphrase',
        port: 'Port',
        privateKeyFile: 'Private Key',
        rememberPassphrase: 'Remember Passphrase',
        rememberPassword: 'Remember Password',
        tags: 'Tags',
        username: 'Username'
      },
      placeholders: {
        credential: 'Select an existing credential (optional)',
        host: '192.168.1.10 or demo.example.com',
        name: 'My Server',
        note: 'Record environment notes, jump-host topology, or maintenance details.',
        privateKeyFile: 'Paste the private key content, or import it from a PEM / KEY / PPK file',
        privateKeySecret: 'Leave empty if there is no passphrase',
        savedPassword: 'Leave empty to keep the saved password',
        ungrouped: 'Ungrouped',
        username: 'root / ubuntu / admin'
      },
      sections: {
        basic: 'Basic',
        connection: 'Connection',
        credentials: 'Credentials',
        note: 'Notes',
        privateKey: 'Private Key',
        strategy: 'Connection Strategy',
        tags: 'Tags'
      },
      systemKeychain: {
        available: 'Stored in the system keychain for reuse on future connections.',
        unavailable: 'No system keychain is available in the current environment.'
      },
      toasts: {
        created: 'Server created.',
        updated: 'Server updated.'
      },
      validation: {
        failed: 'Server form validation failed.'
      }
    },
    sessionEditor: {
      closed: {
        description: 'Reconnect to the server from Explorer to keep working.',
        title: 'This session has already closed'
      },
      portForwards: 'Port Forwards',
      remoteFiles: 'Remote Files',
      cancel: 'Cancel'
    },
    portForward: {
      actions: {
        newRule: 'New Rule'
      },
      dialog: {
        create: 'New Port Forward Rule',
        description:
          'Rules belong only to the current session tab and start immediately after saving.'
      },
      directions: {
        local: 'Listen locally and forward traffic to the remote target.',
        remote: 'Listen remotely and forward traffic to the local target.'
      },
      empty: {
        rules: 'There are no port forwarding rules for this session yet.'
      },
      fields: {
        bindHost: 'Bind Host',
        bindPort: 'Bind Port',
        kind: 'Forwarding Type',
        targetHost: 'Target Host',
        targetPort: 'Target Port'
      },
      kinds: {
        local: 'Local Forward',
        remote: 'Remote Forward'
      },
      statuses: {
        active: 'Active',
        error: 'Error',
        starting: 'Starting',
        stopped: 'Stopped'
      },
      subtitle: 'Temporary port forwarding rules that follow the current session tab.',
      title: 'Port Forwards',
      unavailableHint:
        'This session is unavailable. Reconnect it before creating, starting, stopping, or deleting rules.',
      warnings: {
        publicBind:
          'Binding to {{host}} exposes the listener beyond loopback. Confirm that this is intended.'
      }
    },
    settings: {
      cursorStyles: {
        bar: 'Bar',
        block: 'Block',
        underline: 'Underline'
      },
      descriptions: {
        appearance: 'Adjust language, theme, and window title bar mode.',
        credentialVault: 'Manage reusable passwords, private keys, and passphrases.',
        security: 'Review credential storage support and trusted hosts.',
        terminal: 'Adjust terminal font, cursor, and copy behavior.'
      },
      form: {
        copyOnSelect: {
          description: 'Closer to typical terminal behavior.',
          title: 'Copy on select'
        },
        cursorBlink: {
          description: 'Makes it easier to find the current input position.',
          title: 'Blinking cursor'
        },
        cursorStyle: 'Cursor style',
        language: 'Display language',
        terminalFontFamilyError:
          'Failed to load system fonts. You can still enter a custom font stack.',
        terminalFontFamilyEmpty: 'No matching system fonts.',
        terminalFontFamilyHint:
          'Detected {{count}} system fonts. You can also enter a custom font stack.',
        terminalFontFamilyLoading: 'Loading system fonts...',
        terminalFontFamilySearchPlaceholder: 'Search system fonts or type a custom stack',
        terminalFontFamilyUseCustom: 'Use "{{value}}"',
        terminalFontFamily: 'Terminal font',
        terminalFontSize: 'Terminal font size',
        theme: 'Theme mode',
        titleBarStyle: 'Window title bar'
      },
      knownHosts: {
        actions: 'Actions',
        algorithm: 'Algorithm',
        empty: 'There are no trusted hosts yet.',
        fingerprint: 'Fingerprint',
        host: 'Host',
        title: 'Trusted Hosts',
        verified: 'Verified'
      },
      sections: {
        appearance: 'Appearance',
        credentialVault: 'Credential Vault',
        security: 'Security',
        terminal: 'Terminal'
      },
      security: {
        available:
          'The current environment supports the system keychain, so passwords and passphrases are stored securely when possible.',
        unavailable:
          'No system keychain was detected, so the app does not persist passwords or passphrases.'
      },
      subtitle: 'Adjust language, theme, terminal settings, and security options.',
      title: 'Settings Editor',
      titleBar: {
        restartDescription: 'Changing the window title bar mode requires restarting the app.',
        restartTitle: 'Title bar mode saved'
      },
      toasts: {
        knownHostDeleted: 'Trusted host {{host}} deleted.',
        knownHostDeleteFailed: 'Failed to delete the trusted host.',
        saved: 'Settings saved.'
      },
      validation: {
        failed: 'Settings form validation failed.'
      }
    },
    shell: {
      terminalWelcome: {
        description: 'Select a server in Explorer or create a new connection and start from there.',
        title: 'No active sessions yet'
      }
    },
    sftp: {
      actions: {
        backToParent: 'Go to Parent Directory',
        copyPath: 'Copy Path',
        copyPathToTerminal: 'Send Path to Terminal',
        openDirectory: 'Open Directory'
      },
      dialogs: {
        createFile: 'New File',
        createFolder: 'New Folder',
        rename: 'Rename'
      },
      empty: {
        directory: 'This directory is empty.',
        noSessionDescription:
          'Start an SSH session first and the SFTP panel will follow the active tab automatically.',
        noSessionTitle: 'No active session'
      },
      explorer: 'SFTP Explorer',
      kinds: {
        directory: 'Directory',
        symlink: 'Symlink'
      },
      labels: {
        currentPath: 'Current Path'
      },
      placeholders: {
        fileName: 'Enter a file name',
        directoryName: 'Enter a directory name',
        rename: 'New name'
      },
      toasts: {
        pathCopied: 'Path copied.',
        pathCopyFailed: 'Failed to copy the path.',
        pathSendToTerminalFailed: 'Failed to send the path to the terminal.',
        pathSentToTerminal: 'Path sent to the terminal.'
      }
    },
    statusBar: {
      panelOff: 'panel off',
      panelOn: 'panel on',
      sessions: '{{count}} sessions',
      sidebarOff: 'sidebar off',
      sidebarOn: 'sidebar on',
      theme: 'theme {{value}}'
    },
    terminal: {
      connected: {
        defaultMessage: 'The SSH session is ready. Switching focus to the terminal.',
        title: 'Connected to {{name}}'
      },
      connecting: {
        currentStage: 'Current Stage',
        defaultMessage:
          'The connection has started. Preparing the session tab and terminal environment.',
        title: 'Connecting to {{name}}'
      },
      stages: {
        attach: 'Attaching the shell and switching into the session',
        handshake: 'Verifying the host and negotiating the SSH handshake',
        prepare: 'Opening the terminal channel and preparing the remote environment',
        validate: 'Validating credentials and connection parameters'
      },
      unavailable: {
        defaultMessage: 'Try reconnecting this tab.',
        title: 'This session is currently unavailable'
      }
    },
    titleBar: {
      commandPaletteTitle: 'Command Palette',
      closeWindow: 'Close Window',
      maximizeWindow: 'Maximize Window',
      minimizeWindow: 'Minimize Window',
      quickOpenTitle: 'Quick Connect',
      restoreWindow: 'Restore Window'
    },
    toasts: {
      connectionFailed: 'Connection failed.',
      reconnected: 'Reconnected to {{name}}.',
      reconnectFailed: 'Reconnect failed.',
      serverDeleted: 'Server deleted.',
      serverConfigMissing: 'Could not find the saved server configuration.',
      sessionConnected: 'Connected to {{name}}.'
    },
    output: {
      connectedTo: 'Connected to {{name}}',
      connectingTo: 'Connecting to {{name}}',
      downloadCompleted: 'Download completed: {{fileName}}',
      portForwardActive: 'Port forward active',
      portForwardStopped: 'Port forward stopped',
      reconnecting: 'Reconnecting {{name}}',
      sessionDisconnected: 'Session disconnected',
      sessionExited: 'Session exited: {{sessionId}}',
      sessionStateChanged: 'Session state changed to {{status}}',
      uploadCompleted: 'Upload completed: {{fileName}}'
    },
    credentialVault: {
      title: 'Credential Vault',
      actions: {
        new: 'New Credential'
      },
      dialog: {
        createTitle: 'New Credential',
        editTitle: 'Edit Credential',
        deleteTitle: 'Delete Credential',
        deleteDescription:
          'This permanently deletes the credential "{{name}}". Servers referencing it will fall back to their inline credentials. This action cannot be undone.'
      },
      empty: 'No credentials saved yet. Click "New Credential" to add one.',
      fields: {
        kind: 'Type',
        name: 'Name',
        note: 'Notes',
        passphrase: 'Passphrase',
        password: 'Password',
        privateKey: 'Private Key',
        username: 'Username'
      },
      kinds: {
        password: 'Password',
        privateKey: 'Private Key'
      },
      placeholders: {
        name: 'e.g. Production Key, Bastion Account',
        note: 'Optional notes',
        passphrase: 'Leave empty if there is no passphrase',
        password: 'Enter the password',
        privateKey: 'Paste the private key content, or import from a file',
        username: 'e.g. root, ubuntu'
      },
      privateKeyAuth: 'Private key authentication',
      toasts: {
        created: 'Credential created.',
        deleted: 'Credential deleted.',
        updated: 'Credential updated.'
      }
    }
  }
}

export default workbench
