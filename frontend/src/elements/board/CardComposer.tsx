import { faPlus, faXmark } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useState } from 'react';
import ActionIcon from '@/elements/buttons/ActionIcon.tsx';
import Button from '@/elements/buttons/Button.tsx';
import ServerMultiSelect from '@/elements/input/ServerMultiSelect.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import type { Server } from '../../lib/api.ts';
import { MAX_SERVERS_PER_GROUP } from '../../lib/constants.ts';
import { ServerGroup, useBoardActionsContext } from '../../lib/useBoardActions.ts';
import { useExtTranslations } from '../../translations.ts';

// Trello's "Add a card" composer, picking existing servers instead of typing a title.
export default function CardComposer({
  group,
  opened,
  setOpened,
}: {
  group: ServerGroup;
  opened: boolean;
  setOpened: (opened: boolean) => void;
}) {
  const { t } = useTranslations();
  const { t: tExt } = useExtTranslations();
  const actions = useBoardActionsContext();

  const [selected, setSelected] = useState<Server[]>([]);
  const [loading, setLoading] = useState(false);

  const full = group.serverOrder.length >= MAX_SERVERS_PER_GROUP;
  const toAdd = selected.filter((server) => !group.serverOrder.includes(server.uuid));
  const overLimit = group.serverOrder.length + toAdd.length > MAX_SERVERS_PER_GROUP;

  const close = () => {
    setSelected([]);
    setOpened(false);
  };

  if (!opened) {
    return (
      <button
        type='button'
        disabled={full}
        onClick={() => setOpened(true)}
        className='flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-(--mantine-color-dimmed) transition-colors hover:bg-(--mantine-color-default-hover) hover:text-(--mantine-color-text) disabled:cursor-not-allowed disabled:opacity-50'
      >
        <FontAwesomeIcon icon={faPlus} className='text-xs' />
        {full ? tExt('board.list.full', {}) : tExt('board.composer.addCard', {})}
      </button>
    );
  }

  return (
    <div className='flex flex-col gap-2'>
      <ServerMultiSelect
        value={selected}
        onChange={setSelected}
        exclude={group.serverOrder}
        withOthersSwitch
        placeholder={tExt('board.composer.placeholder', {})}
        autoFocus
        size='xs'
        onKeyDown={(e) => {
          if (e.key === 'Escape') close();
        }}
      />
      <div className='flex items-center gap-1'>
        <Button
          size='xs'
          loading={loading}
          disabled={!toAdd.length || overLimit}
          onClick={() => {
            setLoading(true);
            actions
              .addServers(group.uuid, toAdd)
              .then((ok) => ok && close())
              .finally(() => setLoading(false));
          }}
        >
          {tExt('board.composer.add', {})}
        </Button>
        <ActionIcon variant='subtle' color='gray' onClick={close} aria-label={t('common.button.close', {})}>
          <FontAwesomeIcon icon={faXmark} />
        </ActionIcon>
      </div>
    </div>
  );
}
