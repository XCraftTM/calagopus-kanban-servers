import { faArrowsUpDown, faGripLines } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useForm } from '@mantine/form';
import { useQueryClient } from '@tanstack/react-query';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useEffect, useRef, useState } from 'react';
import { httpErrorToHuman } from '@/api/axios.ts';
import Button from '@/elements/buttons/Button.tsx';
import TitleCard from '@/elements/data-display/TitleCard.tsx';
import Spinner from '@/elements/feedback/Spinner.tsx';
import NumberInput from '@/elements/input/NumberInput.tsx';
import Switch from '@/elements/input/Switch.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import { useKeyboardShortcut } from '@/plugins/quick-actions/useKeyboardShortcuts.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import {
  CARD_GAP_MAX,
  CARD_GAP_MIN,
  defaultKanbanSettings,
  getSettings,
  type KanbanSettings,
  kanbanSettingsSchema,
  updateSettings,
} from '../lib/config.ts';
import { queryKeys } from '../lib/constants.ts';
import { useExtTranslations } from '../translations.ts';

function GapPreview({ gap }: { gap: number }) {
  return (
    <div className='flex w-56 flex-col rounded-xl border border-(--mantine-color-default-border) bg-(--mantine-color-dark-7) p-2 light:bg-(--mantine-color-gray-1)!'>
      <div className='flex flex-col' style={{ gap }}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className='h-9 rounded-lg border border-(--mantine-color-default-border) bg-(--mantine-color-dark-6) light:bg-white!'
          />
        ))}
      </div>
    </div>
  );
}

export default function ConfigurationPage() {
  const { t } = useTranslations();
  const { t: tExt } = useExtTranslations();
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const form = useForm<KanbanSettings>({
    initialValues: defaultKanbanSettings,
    validateInputOnBlur: true,
    validate: zod4Resolver(kanbanSettingsSchema),
  });

  useEffect(() => {
    getSettings()
      .then((settings) => {
        form.setValues(settings);
        form.resetDirty(settings);
      })
      .catch((err) => addToast(httpErrorToHuman(err), 'error'))
      .finally(() => setLoading(false));
    // load once
  }, []);

  const save = form.onSubmit((values) => {
    setSaving(true);
    updateSettings(values)
      .then((saved) => {
        form.setValues(saved);
        form.resetDirty(saved);
        queryClient.setQueryData(queryKeys.config(), saved);
        addToast(tExt('settings.toast.saved', {}), 'success');
      })
      .catch((err) => addToast(httpErrorToHuman(err), 'error'))
      .finally(() => setSaving(false));
  });

  // the panel-wide save shortcut (Ctrl/Cmd+S unless rebound) runs the same validation as the button
  const formRef = useRef<HTMLFormElement>(null);
  const savingRef = useRef(false);
  savingRef.current = saving;
  useKeyboardShortcut(
    's',
    () => {
      if (!savingRef.current) formRef.current?.requestSubmit();
    },
    { id: 'general.save' },
  );

  if (loading) return <Spinner.Centered />;

  const gap = Number.isFinite(form.values.cardGap) ? form.values.cardGap : defaultKanbanSettings.cardGap;

  return (
    <form ref={formRef} onSubmit={save}>
      <Stack>
        <Button type='submit' loading={saving} disabled={!form.isValid()} className='w-fit!'>
          {t('common.button.save', {})}
        </Button>

        <TitleCard title={tExt('settings.cards.title', {})} icon={<FontAwesomeIcon icon={faGripLines} />}>
          <div className='flex flex-wrap items-start gap-6'>
            <NumberInput
              className='w-64'
              label={tExt('settings.cards.gap', {})}
              description={tExt('settings.cards.gapDescription', { min: CARD_GAP_MIN, max: CARD_GAP_MAX })}
              min={CARD_GAP_MIN}
              max={CARD_GAP_MAX}
              step={1}
              allowDecimal={false}
              suffix=' px'
              {...form.getInputProps('cardGap')}
            />
            <div>
              <p className='mb-1.5 text-xs font-medium text-(--mantine-color-dimmed)'>
                {tExt('settings.cards.preview', {})}
              </p>
              <GapPreview gap={gap} />
            </div>
          </div>
        </TitleCard>

        <TitleCard title={tExt('settings.lists.title', {})} icon={<FontAwesomeIcon icon={faArrowsUpDown} />}>
          <Switch
            label={tExt('settings.lists.stacking', {})}
            description={tExt('settings.lists.stackingDescription', {})}
            {...form.getInputProps('allowListStacking', { type: 'checkbox' })}
          />
        </TitleCard>
      </Stack>
    </form>
  );
}
