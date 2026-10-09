import { faTableColumns } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Extension, ExtensionContext } from 'shared';
import DashboardHomeTitle from '@/pages/dashboard/home/DashboardHomeTitle.tsx';
import KanbanSwitch from './elements/KanbanSwitch.tsx';
import ViewToggle from './elements/ViewToggle.tsx';
import { containsElementOfType } from './lib/react.ts';

class DevXcrafttmKanbanserversExtension extends Extension {
  public cardConfigurationPage: React.FC | null = null;
  public cardComponent: React.FC | null = null;
  public cardIcon: React.ReactNode = <FontAwesomeIcon icon={faTableColumns} />;

  public initialize(ctx: ExtensionContext): void {
    ctx.extensionRegistry.pages.dashboard.home.enterContainerGrouped((container) =>
      container.addPropsInterceptor((props) => {
        // themes may hide the page header (and with it `contentRight`) or move the tabs into their own
        // toolbar; in that case the board shows the toggle itself and skips its own copy of the tabs
        const headerHidden = !!props.hideTitleComponent;

        return {
          ...props,
          contentRight: headerHidden ? (
            props.contentRight
          ) : (
            <>
              {props.contentRight}
              <ViewToggle />
            </>
          ),
          children: (
            <KanbanSwitch
              fallback={props.children}
              showTitle={containsElementOfType(props.children, DashboardHomeTitle)}
              inlineToggle={headerHidden}
            />
          ),
        };
      }),
    );
  }
}

export default new DevXcrafttmKanbanserversExtension();
