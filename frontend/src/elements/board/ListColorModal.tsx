import { faPalette, faXmark } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { ColorPicker, useMantineTheme } from '@mantine/core';
import classNames from 'classnames';
import { useEffect, useState } from 'react';
import Button from '@/elements/buttons/Button.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import { Modal, ModalFooter } from '@/elements/modals/Modal.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { colorToCss, hexColorSchema, isPresetColor, type ListColorValue, listColors } from '../../lib/constants.ts';
import { useExtTranslations } from '../../translations.ts';
import { listTintStyle, plainListClasses, tintedListClasses } from './listTint.ts';

export default function ListColorModal({
  opened,
  onClose,
  listName,
  color,
  onSave,
}: {
  opened: boolean;
  onClose: () => void;
  listName: string;
  color: ListColorValue | null;
  onSave: (color: ListColorValue | null) => void;
}) {
  const { t } = useTranslations();
  const { t: tExt } = useExtTranslations();
  const theme = useMantineTheme();

  const [value, setValue] = useState<ListColorValue | null>(color);
  const [hexInput, setHexInput] = useState('');

  // the picker only understands hex, so presets are shown at their palette shade
  const toHex = (c: ListColorValue | null) => (!c ? '' : isPresetColor(c) ? theme.colors[c][6] : c);

  useEffect(() => {
    if (!opened) return;
    setValue(color);
    setHexInput(toHex(color));
    // reset only when the dialog opens
  }, [opened]);

  const hexValid = hexInput === '' || hexColorSchema.safeParse(hexInput).success;

  return (
    <Modal title={tExt('board.list.colorModal.title', { list: listName })} opened={opened} onClose={onClose}>
      <div className='flex flex-col gap-4'>
        <div
          className={classNames('overflow-hidden rounded-xl border', value ? tintedListClasses : plainListClasses)}
          style={listTintStyle(value)}
        >
          {value && <div aria-hidden className='h-1.5' style={{ backgroundColor: colorToCss(value) }} />}
          <div className='flex items-center gap-2 px-3 py-2'>
            <span className='text-sm font-semibold truncate'>{listName}</span>
            <span className='ml-auto text-xs text-(--mantine-color-dimmed)'>
              {tExt('board.list.colorModal.preview', {})}
            </span>
          </div>
          <div className='px-2 pb-2'>
            <div className='h-9 rounded-lg border border-(--mantine-color-default-border) bg-(--mantine-color-dark-6) light:bg-white!' />
          </div>
        </div>

        <div>
          <p className='mb-1.5 text-xs font-medium text-(--mantine-color-dimmed)'>
            {tExt('board.list.colorModal.presets', {})}
          </p>
          <div className='grid grid-cols-12 gap-1.5'>
            {listColors.map((c) => (
              <button
                key={c}
                type='button'
                aria-label={c}
                onClick={() => {
                  setValue(c);
                  setHexInput(toHex(c));
                }}
                className={classNames(
                  'h-7 w-full rounded-md transition-transform hover:scale-110',
                  c === value && 'ring-2 ring-offset-1 ring-(--mantine-color-text) ring-offset-(--mantine-color-body)',
                )}
                style={{ backgroundColor: colorToCss(c) }}
              />
            ))}
            <button
              type='button'
              aria-label={tExt('board.list.menu.noColor', {})}
              title={tExt('board.list.menu.noColor', {})}
              onClick={() => {
                setValue(null);
                setHexInput('');
              }}
              className={classNames(
                'h-7 w-full rounded-md border border-dashed border-(--mantine-color-default-border) text-(--mantine-color-dimmed) transition-transform hover:scale-110',
                value === null && 'ring-2 ring-offset-1 ring-(--mantine-color-text) ring-offset-(--mantine-color-body)',
              )}
            >
              <FontAwesomeIcon icon={faXmark} className='text-xs' />
            </button>
          </div>
        </div>

        <div>
          <p className='mb-1.5 text-xs font-medium text-(--mantine-color-dimmed)'>
            <FontAwesomeIcon icon={faPalette} className='mr-1.5' />
            {tExt('board.list.colorModal.custom', {})}
          </p>
          <ColorPicker
            fullWidth
            format='hex'
            value={toHex(value) || theme.colors.blue[6]}
            onChange={(hex) => {
              setValue(hex.toLowerCase());
              setHexInput(hex.toLowerCase());
            }}
          />
          <TextInput
            mt='sm'
            size='sm'
            label={tExt('board.list.colorModal.hex', {})}
            placeholder='#3b82f6'
            value={hexInput}
            maxLength={7}
            error={hexValid ? undefined : tExt('board.list.colorModal.invalidHex', {})}
            leftSection={
              <span
                className='size-4 rounded-sm border border-(--mantine-color-default-border)'
                style={{ backgroundColor: value ? colorToCss(value) : 'transparent' }}
              />
            }
            onChange={(e) => {
              const next = e.currentTarget.value.trim();
              setHexInput(next);
              if (hexColorSchema.safeParse(next).success) setValue(next.toLowerCase());
            }}
          />
        </div>
      </div>

      <ModalFooter>
        <Button
          disabled={!hexValid}
          onClick={() => {
            onSave(value);
            onClose();
          }}
        >
          {t('common.button.save', {})}
        </Button>
        <Button variant='default' onClick={onClose}>
          {t('common.button.cancel', {})}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
