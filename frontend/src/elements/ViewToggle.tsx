import { faList, faTableColumns } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import SegmentedControl from '@/elements/layout/SegmentedControl.tsx';
import { useUserSetting } from '@/lib/userSettings.ts';
import { settingKeys, viewSchema } from '../lib/constants.ts';
import { useExtTranslations } from '../translations.ts';

export function useBoardView() {
  return useUserSetting(settingKeys.view, viewSchema, 'board');
}

export default function ViewToggle() {
  const { t: tExt } = useExtTranslations();
  const [view, setView] = useBoardView();

  return (
    <SegmentedControl
      size='xs'
      aria-label={tExt('view.label', {})}
      value={view}
      onChange={(value) => setView(viewSchema.parse(value))}
      data={[
        {
          value: 'board',
          label: (
            <span className='flex items-center gap-1.5'>
              <FontAwesomeIcon icon={faTableColumns} />
              {tExt('view.board', {})}
            </span>
          ),
        },
        {
          value: 'list',
          label: (
            <span className='flex items-center gap-1.5'>
              <FontAwesomeIcon icon={faList} />
              {tExt('view.list', {})}
            </span>
          ),
        },
      ]}
    />
  );
}
