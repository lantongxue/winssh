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
      localTerminal: 'Local Terminal',
      remoteFile: 'Remote File',
      serverEditor: {
        newConnection: 'Untitled Connection'
      },
      settings: 'Settings',
      updates: 'Updates',
      terminal: 'Terminal',
      terminalWelcome: 'Terminal'
    },
    editorTabs: {
      actions: {
        cloneSession: 'Clone Session',
        closeTab: 'Close Tab',
        copyIp: 'Copy IP',
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
      clearOutput: 'Clear Output',
      clearProblems: 'Clear Problems',
      clearTransfers: 'Clear Transfers',
      empty: {
        logs: 'No log entries yet.',
        output: 'Connection logs and workbench output appear here.',
        problems: 'No workbench-level issues right now.',
        transfers: 'No transfers yet.'
      },
      labels: {
        logs: 'Logs',
        output: 'Output',
        problems: 'Problems',
        transfers: 'Transfers'
      },
      logs: {
        actions: {
          clear: 'Clear Logs',
          savePath: 'Save Path'
        },
        description:
          'Read recent application logs, clear the current file, or move future logs to another file path.',
        pathPlaceholder: 'C:\\path\\to\\winssh.log',
        title: 'Application Logs',
        toasts: {
          cleared: 'Logs cleared.',
          clearFailed: 'Failed to clear logs.',
          pathUpdated: 'Log file path updated.',
          pathUpdateFailed: 'Failed to update the log file path.'
        }
      },
      severities: {
        error: 'Error',
        warning: 'Warning'
      },
      transfer: {
        batchProgress: '{{completed}} / {{total}} files',
        cancel: 'Cancel',
        cancelAll: 'Cancel All',
        cancelled: 'Cancelled',
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
        createServer: 'New Server',
        createSubgroup: 'New Subgroup',
        createTag: 'New Tag',
        edit: 'Edit',
        moveToGroup: 'Move to Group',
        removeFromFavorites: 'Remove from Favorites',
        rename: 'Rename'
      },
      description: 'Single-click to open the editor, double-click to start an SSH session.',
      labels: {
        connected: 'Connected',
        ungrouped: 'Ungrouped'
      },
      search: {
        clear: 'Clear search',
        empty: 'No servers match "{{query}}".',
        label: 'Quick server search',
        placeholder: 'Search by server name or IP',
        results: 'Search Results'
      },
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
        groups: 'Server Management',
        recent: 'Recent',
        tags: 'Tags'
      },
      title: 'Explorer',
      toasts: {
        groupDeleted: 'Group deleted.',
        recentCleared: 'Recent connections cleared.',
        serverDeleteFailed: 'Failed to delete the server.',
        serverMoveFailed: 'Failed to move the server.',
        serverMoved: '{{name}} moved to {{group}}.',
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
        addTag: 'Add Tag',
        createJumpServer: 'New Jump Server',
        deleteTag: 'Delete {{name}}',
        hideSecret: 'Hide secret',
        removeCustomIcon: 'Remove Custom Icon',
        showSecret: 'Show secret'
      },
      auth: {
        password: 'Password',
        privateKey: 'Private Key'
      },
      brands: {
        archlinux: 'Arch Linux',
        centos: 'CentOS',
        debian: 'Debian',
        fedora: 'Fedora',
        linux: 'Linux',
        macos: 'macOS',
        redhat: 'Red Hat',
        suse: 'SUSE',
        ubuntu: 'Ubuntu'
      },
      descriptions: {
        brand:
          'The built-in brand icon is detected on the first successful connection. A custom icon overrides the built-in brand without clearing it.',
        brandCustomIcon: 'A custom icon is active for this server.',
        brandDetected: 'Detected from the server during the first successful connection.',
        brandPending:
          'This server will be identified automatically after the first successful connection.',
        existing: '{{username}}@{{host}}:{{port}}',
        jumpServer:
          'Choose an existing jump server, or quickly create a minimal one for this route.',
        new: 'New SSH connection',
        tagsInput: 'Press Enter to select an existing tag or create a new one inline.'
      },
      empty: {
        tags: 'No tags yet. Create one here or from Explorer.'
      },
      fields: {
        authType: 'Authentication',
        brand: 'Brand',
        connectNote: 'Connection Notes',
        credential: 'Use Credential',
        credentials: 'Credentials',
        favoriteDescription: 'Favorited servers are prioritized in Explorer.',
        favoriteTitle: 'Favorite this server',
        group: 'Group',
        host: 'Host',
        jumpServer: 'Jump Server',
        name: 'Name',
        note: 'Notes',
        password: 'Password',
        passphrase: 'Passphrase',
        port: 'Port',
        privateKeyFile: 'Private Key',
        rememberPassphrase: 'Remember Passphrase',
        rememberPassword: 'Remember Password',
        tagInput: 'Add Tag',
        tags: 'Tags',
        username: 'Username'
      },
      placeholders: {
        credential: 'Select an existing credential (optional)',
        host: '192.168.1.10 or demo.example.com',
        jumpServer: 'Connect directly without a jump server',
        name: 'My Server',
        note: 'Record environment notes, jump-host topology, or maintenance details.',
        privateKeyFile: 'Paste the private key content, or import it from a PEM / KEY / PPK file',
        privateKeySecret: 'Leave empty if there is no passphrase',
        savedPassword: 'Leave empty to keep the saved password',
        tag: 'Type a tag name and press Enter',
        ungrouped: 'Ungrouped',
        username: 'root / ubuntu / admin'
      },
      jumpServer: {
        dialog: {
          description:
            'Create a minimal jump server profile, save it immediately, and tag it as jumpserver.',
          title: 'New Jump Server'
        },
        placeholders: {
          name: 'Production Jump Server',
          password: 'Enter the jump server password'
        }
      },
      sections: {
        basic: 'Basic',
        brand: 'Brand',
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
        jumpServerCreated: 'Jump server {{name}} created.',
        saveFailed: 'Unable to save the server.',
        tagDeleteFailed: 'Unable to delete tag.',
        tagCreateFailed: 'Unable to create tag.',
        updated: 'Server updated.'
      },
      validation: {
        failed: 'Server form validation failed.'
      }
    },
    sessionEditor: {
      actions: {
        copyIp: 'Copy IP'
      },
      closed: {
        description: 'Reconnect to the server from Explorer to keep working.',
        title: 'This session has already closed'
      },
      portForwards: 'Port Forwards',
      serverAddress: 'Server Address',
      serverName: 'Server Name',
      resourceMonitor: {
        linuxOnly: 'Linux only',
        metrics: {
          cpu: 'CPU',
          disk: 'Disk (/)',
          memory: 'Memory',
          network: 'Network'
        },
        title: 'Resource Monitor',
        toggle: 'Toggle resource monitor',
        unavailable: 'Unavailable',
        usage: 'Usage'
      },
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
        about: 'Review app details and version information.',
        appearance: 'Adjust language, theme, and window title bar mode.',
        backup: 'Configure WebDAV scheduled backups to sync data to remote storage safely.',
        credentialVault: 'Manage reusable passwords, private keys, and passphrases.',
        security: 'Review credential storage support and trusted hosts.',
        updates:
          'Check the current update status and decide when to download or install new versions.',
        terminal:
          'Adjust the local shell, terminal font, cursor, copy behavior, and experimental rendering.'
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
        experimentalTerminalWebgl: {
          description:
            'Experimental support. Requires available GPU acceleration. In some Windows and Electron environments it can cause blurry terminal text, incorrect font weight, or other font rendering issues. Disable it if terminal fonts look wrong.',
          title: 'Experimental WebGL renderer'
        },
        resourceMonitorInterval: 'Resource monitor interval (ms)',
        resourceMonitorIntervalDescription:
          'How often the session resource monitor polls for CPU, memory, network, and disk data. Minimum 500 ms, maximum 30000 ms.',
        sftpUploadConcurrency: 'SFTP upload concurrency',
        sftpUploadConcurrencyDescription:
          'Maximum number of files to upload simultaneously. Minimum 1, maximum 16.',
        sftpDownloadConcurrency: 'SFTP download concurrency',
        sftpDownloadConcurrencyDescription:
          'Maximum number of files to download simultaneously. Minimum 1, maximum 16.',
        cursorStyle: 'Cursor style',
        language: 'Display language',
        localTerminalShell: 'Local terminal shell',
        localTerminalShellDescription: 'Applies to newly opened local terminal tabs.',
        uiFont: 'Interface font',
        terminalFont: 'Terminal font',
        editorFont: 'Editor font',
        editorFontFollowTerminal: 'Follow terminal font',
        terminalFontSize: 'Terminal font size',
        theme: 'Theme mode',
        titleBarStyle: 'Window title bar',
        webdavBackupEnabled: {
          description: 'Automatically upload database backups to WebDAV at the set interval.',
          title: 'Enable WebDAV auto backup'
        },
        webdavBackupInterval: 'Backup interval (minutes)',
        webdavBackupIntervalDescription: 'Minimum 15 minutes, maximum 10080 minutes (7 days).',
        webdavBackupPath: 'Remote backup path',
        webdavPassword: 'WebDAV password',
        webdavPasswordDescription: 'Password is stored in system secure storage, not in config.',
        webdavPasswordPlaceholder: 'Enter new password to update',
        webdavUrl: 'WebDAV server URL',
        webdavUsername: 'WebDAV username'
      },
      localTerminalShells: {
        bash: 'Bash',
        cmd: 'Command Prompt (cmd)',
        powershell: 'PowerShell',
        zsh: 'Zsh'
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
        about: 'About',
        appearance: 'Appearance',
        backup: 'Backup',
        credentialVault: 'Credential Vault',
        security: 'Security',
        updates: 'Updates',
        terminal: 'Terminal'
      },
      backup: {
        actions: {
          backupNow: 'Backup Now',
          restore: 'Restore from WebDAV',
          testConnection: 'Test Connection'
        },
        backupFailed: 'Backup failed',
        backupSuccess: 'Backup uploaded to WebDAV successfully.',
        deleteDialog: {
          description:
            'Delete the remote WebDAV backup "{{fileName}}"? This only removes the selected backup file from WebDAV.',
          title: 'Delete WebDAV Backup'
        },
        deleteFailed: 'Failed to delete the WebDAV backup.',
        deleteSuccess: 'Deleted WebDAV backup "{{fileName}}".',
        restoreFailed: 'Restore failed',
        restoreDialog: {
          confirm: 'Restore Selected Backup',
          deleteLabel: 'Delete backup {{fileName}}',
          description:
            'Choose one of the backups currently stored on WebDAV, then restore that database snapshot.',
          empty: 'No WebDAV backups are available yet.',
          loadFailed: 'Failed to load the backup list.',
          loading: 'Loading available WebDAV backups...',
          modifiedAt: 'Modified',
          title: 'Choose a Backup to Restore'
        },
        status: {
          lastBackup: 'Last backup',
          lastError: 'Last error',
          nextBackup: 'Next backup',
          noBackupYet: 'No backup yet',
          title: 'Backup status'
        },
        testFailed: 'Connection test failed',
        testFailedMessage: 'Connection test failed: {{message}}',
        testSuccess: 'Connection test successful: {{message}}'
      },
      about: {
        channels: {
          alpha: 'Alpha',
          beta: 'Preview',
          latest: 'Stable'
        },
        intro: {
          description:
            'WinSSH is a stable desktop SSH workspace focused on terminals, files, forwarding, and reusable connection management. Updates, platform details, and workbench polish continue to improve from this official release line.',
          title: 'About WinSSH'
        },
        version: {
          channelLabel: 'Release channel',
          nameLabel: 'Application',
          platformLabel: 'Platform',
          title: 'Version Information',
          versionLabel: 'Version'
        }
      },
      updates: {
        actions: {
          check: 'Check for Updates',
          download: 'Download Update',
          install: 'Restart to Install'
        },
        autoCheck: {
          description:
            'Checks for updates when the app starts. This does not download updates automatically.',
          title: 'Automatically check for updates'
        },
        description:
          'Windows builds can check the configured update feed and let you choose when to download and install a new version.',
        status: {
          available: 'Update {{version}} is available.',
          buildUnsupported: 'The current build does not support automatic updates.',
          checking: 'Checking for updates...',
          downloaded: 'Update downloaded and ready to install.',
          downloading: 'Downloading update... {{percent}}%',
          error: 'Update failed.',
          feedMissing: 'This build was not configured with an update feed.',
          idle: 'Automatic updates are ready when you want to check.',
          notAvailable: 'You are already on the latest version.',
          platformUnsupported: 'Automatic updates are not supported on {{platform}} in this build.'
        },
        statusLabel: 'Update status',
        title: 'Automatic Updates',
        toasts: {
          checkFailed: 'Failed to check for updates.',
          downloadFailed: 'Failed to download the update.',
          installFailed: 'Failed to start the installer.'
        }
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
      themeManagement: {
        deleteDescription:
          'This removes the imported theme pack "{{name}}" and all themes it contains. Built-in themes are not affected.',
        deleteTitle: 'Delete Imported Theme Pack',
        empty: 'No imported theme packs yet. Import a ZIP theme pack to add more themes.',
        importDescription:
          'Import WinSSH theme packs as ZIP archives. Imported themes appear in the theme list immediately.',
        importedThemes: 'Imported themes',
        title: 'Theme Packs'
      },
      toasts: {
        themeDeleteFailed: 'Failed to delete the imported theme pack.',
        themeDeleted: 'Theme pack "{{name}}" deleted.',
        themeImportFailed: 'Failed to import the theme pack.',
        themeImported: 'Theme pack "{{name}}" imported.',
        knownHostDeleted: 'Trusted host {{host}} deleted.',
        knownHostDeleteFailed: 'Failed to delete the trusted host.',
        saved: 'Settings saved.'
      },
      validation: {
        failed: 'Settings form validation failed.'
      }
    },
    updateDialog: {
      actions: {
        download: 'Download Update',
        install: 'Restart to Install',
        later: 'Later'
      },
      description: 'WinSSH {{version}} is available. Download it now or come back to it later.',
      descriptions: {
        checking: 'Checking the update feed now.',
        downloaded: 'The update has finished downloading and is ready to install.',
        downloading: 'Downloading the update... {{percent}}%',
        error: 'Something went wrong while checking or downloading updates.',
        idle: 'Preparing the update workflow.',
        notAvailable: 'You are already on the latest available version.',
        unsupported: 'Automatic updates are unavailable in the current environment.'
      },
      title: 'Update Available',
      titles: {
        checking: 'Checking for Updates',
        downloaded: 'Ready to Install',
        downloading: 'Downloading Update',
        error: 'Update Failed',
        notAvailable: 'You Are Up to Date',
        unsupported: 'Updates Unavailable'
      }
    },
    updatesEditor: {
      releaseDate: 'Release date'
    },
    shell: {
      terminalWelcome: {
        description: 'Select a server in Explorer or create a new connection and start from there.',
        title: 'No active sessions yet'
      }
    },
    localTerminal: {
      closed: {
        description: 'This local terminal tab has already been closed.',
        title: 'Local terminal closed'
      },
      exited: {
        description: 'The shell has exited. You can keep this tab open to review its output.',
        title: 'Shell exited'
      },
      status: {
        error: 'Error',
        exited: 'Exited',
        running: 'Running'
      }
    },
    sftp: {
      actions: {
        backToParent: 'Go to Parent Directory',
        copyPath: 'Copy Path',
        copyPathToTerminal: 'Send Path to Terminal',
        flatView: 'Flat View',
        openDirectory: 'Open Directory',
        treeView: 'Tree View'
      },
      dropzone: {
        description: 'Upload them into {{path}}.',
        title: 'Drop files or folders to upload'
      },
      dialogs: {
        createFile: 'New File',
        createFolder: 'New Folder',
        rename: 'Rename'
      },
      deleteDialog: {
        description: 'Are you sure you want to delete this item? This action cannot be undone.',
        title: 'Confirm Delete'
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
        deleteFailed: 'Failed to delete the selected items.',
        listFailed: 'Failed to list directory.',
        pathCopied: 'Path copied.',
        pathCopyFailed: 'Failed to copy the path.',
        pathSendToTerminalFailed: 'Failed to send the path to the terminal.',
        pathSentToTerminal: 'Path sent to the terminal.',
        uploadFailed: 'Failed to upload the selected items.',
        moveFailed: 'Failed to move the selected items.'
      }
    },
    sftpFileEditor: {
      empty: {
        description: 'The file content could not be loaded for editing.',
        title: 'Unable to open file'
      },
      labels: {
        dirty: 'Unsaved',
        fileName: 'File Name',
        language: 'Language',
        path: 'Remote path',
        saved: 'Saved'
      },
      loading: 'Loading remote file...',
      toasts: {
        saveFailed: 'Failed to save the remote file.',
        saved: 'Remote file saved.'
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
      dropPath: {
        fallback: 'Drop to write the remote path into the terminal.',
        title: 'Drop to paste the remote path'
      },
      linkHint: 'Ctrl/Cmd+click to open the link',
      search: {
        close: 'Close terminal search',
        label: 'Search terminal output',
        next: 'Find next result',
        noMatches: 'No matches',
        placeholder: 'Find in terminal',
        previous: 'Find previous result',
        results: '{{current}} / {{total}}',
        shortcut: 'Cmd/Ctrl+F'
      },
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
      openTerminalTitle: 'Open Local Terminal',
      quickOpenTitle: 'Quick Connect',
      restoreWindow: 'Restore Window'
    },
    toasts: {
      connectionFailed: 'Connection failed.',
      ipCopied: 'IP copied.',
      ipCopyFailed: 'Failed to copy IP.',
      localTerminalOpenFailed: 'Failed to open a local terminal.',
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
      localTerminalClosed: 'Local terminal closed',
      localTerminalExited: 'Local terminal exited: {{terminalId}}',
      localTerminalOpened: 'Opened local terminal {{name}}',
      localTerminalStateChanged: 'Local terminal state changed to {{status}}',
      portForwardActive: 'Port forward active',
      portForwardStopped: 'Port forward stopped',
      reconnecting: 'Reconnecting {{name}}',
      sessionDisconnected: 'Session disconnected',
      sessionExited: 'Session exited: {{sessionId}}',
      sessionStateChanged: 'Session state changed to {{status}}',
      uploadCompleted: 'Upload completed: {{fileName}}',
      batchUploadCompleted: 'Upload completed: {{count}} files'
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
