import { faPlus, faXmark } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useState } from 'react';
import ActionIcon from '@/elements/buttons/ActionIcon.tsx';
import Button from '@/elements/buttons/Button.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { GROUP_NAME_MAX, GROUP_NAME_MIN } from '../../lib/constants.ts';
import { useBoardActionsContext } from '../../lib/useBoardActions.ts';
import { useExtTranslations } from '../../translations.ts';

// The translucent "+ Add another list" column at the end of a Trello board.
export default function AddListColumn() {
  const { t } = useTranslations();
  const { t: tExt } = useExtTranslations();
  const actions = useBoardActionsContext();

  const [opened, setOpened] = useState(false);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const trimmed = name.trim();
  const valid = trimmed.length >= GROUP_NAME_MIN && trimmed.length <= GROUP_NAME_MAX;

  const close = () => {
    setName('');
    setOpened(false);
  };

  const submit = () => {
    if (!valid || loading) return;

    setLoading(true);
    actions
      .createGroup(trimmed)
      .then((ok) => {
        // stay open like Trello, ready for the next list
        if (ok) setName('');
      })
      .finally(() => setLoading(false));
  };

  if (!opened) {
    return (
      <button
        type='button'
        onClick={() => setOpened(true)}
        className='flex w-[var(--kanban-list-width,20rem)] shrink-0 items-center gap-2 rounded-xl border border-dashed border-(--mantine-color-default-border) px-3 py-2.5 text-sm font-medium text-(--mantine-color-dimmed) transition-colors hover:border-(--mantine-color-dimmed) hover:bg-(--mantine-color-default-hover) hover:text-(--mantine-color-text)'
      >
        <FontAwesomeIcon icon={faPlus} />
        {tExt('board.addList.button', {})}
      </button>
    );
  }

  return (
    <form
      className='flex w-[var(--kanban-list-width,20rem)] shrink-0 flex-col gap-2 rounded-xl border border-(--mantine-color-default-border) bg-(--mantine-color-dark-7) light:bg-(--mantine-color-gray-1)! p-2'
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <TextInput
        size='xs'
        autoFocus
        value={name}
        maxLength={GROUP_NAME_MAX}
        placeholder={tExt('board.addList.placeholder', {})}
        error={
          trimmed.length > 0 && !valid
            ? tExt('board.list.nameLength', { min: GROUP_NAME_MIN, max: GROUP_NAME_MAX })
            : undefined
        }
        onChange={(e) => setName(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') close();
        }}
      />
      <div className='flex items-center gap-1'>
        <Button type='submit' size='xs' loading={loading} disabled={!valid}>
          {tExt('board.addList.submit', {})}
        </Button>
        <ActionIcon variant='subtle' color='gray' onClick={close} aria-label={t('common.button.close', {})}>
          <FontAwesomeIcon icon={faXmark} />
        </ActionIcon>
      </div>
    </form>
  );
}
