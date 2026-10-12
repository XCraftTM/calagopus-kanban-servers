import { defineTranslations } from 'shared';

const translations = defineTranslations({
  items: {},
  translations: {
    view: {
      label: 'Server view',
      board: 'Board',
      list: 'List',
    },
    settings: {
      cards: {
        title: 'Cards',
        gap: 'Gap between cards',
        gapDescription: 'Space between the cards of a list, from {min} to {max} pixels.',
        preview: 'Preview',
      },
      lists: {
        title: 'Lists',
        stacking: 'Allow stacking lists',
        stackingDescription:
          'Users can drag a list onto another list to stack them on top of each other in one column. Each user arranges their own board.',
      },
      toast: {
        saved: 'Kanban settings saved.',
      },
    },
    board: {
      filter: {
        placeholder: 'Filter cards...',
        status: {
          all: 'All',
          running: 'Running',
          offline: 'Offline',
        },
        clear: 'Clear filter',
        matching: '{count} matching',
      },
      ungrouped: {
        title: 'Ungrouped',
        description: 'Your servers that are not in any list yet. Drag them into a list.',
        show: 'Show ungrouped servers',
        loadMore: 'Load more servers',
        empty: 'Every server is in a list.',
      },
      list: {
        empty: 'Drop servers here',
        noMatches: 'No matching servers',
        full: 'List is full',
        renameHint: 'Click to rename',
        nameLength: 'The name must be between {min} and {max} characters.',
        menu: {
          title: 'List actions',
          addServers: 'Add servers...',
          rename: 'Rename list',
          collapse: 'Collapse list',
          expand: 'Expand list',
          selectAll: 'Select all servers in this list',
          color: 'List color',
          noColor: 'No color',
          customColor: 'Custom color...',
          powerAll: 'Power all servers',
          delete: 'Delete list',
        },
        toast: {
          renamed: 'List renamed.',
        },
        colorModal: {
          title: 'Color of {list}',
          preview: 'Preview',
          presets: 'Presets',
          custom: 'Custom color',
          hex: 'Hex code',
          invalidHex: 'Enter a color like #3b82f6.',
        },
      },
      composer: {
        addCard: 'Add a server',
        add: 'Add',
        placeholder: 'Search servers...',
      },
      addList: {
        button: 'Add another list',
        placeholder: 'Enter list name...',
        submit: 'Add list',
      },
      card: {
        menu: 'Card actions',
        moveTo: 'Move to list',
        copyTo: 'Also add to list',
        remove: 'Remove from list',
        address: 'Copy address',
        cpu: 'CPU',
        memory: 'Memory',
        disk: 'Disk',
        usage: '{used} of {limit}',
        uptime: 'Uptime',
        egg: 'Egg',
        owner: 'Owned by another user',
        toast: {
          added: 'Server added to {group}.',
          removed: 'Server removed from {group}.',
        },
      },
      status: {
        running: 'Running',
        starting: 'Starting',
        stopping: 'Stopping',
        offline: 'Offline',
        unknown: 'Connecting',
      },
      dragHint: 'Tip: drag cards between lists, drag list headers to reorder, and hold S while clicking to select.',
    },
  },
});

export const useExtTranslations = translations.useTranslations.bind(translations);
export const getExtTranslations = translations.getTranslations.bind(translations);

export default translations;
