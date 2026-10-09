import { faTableColumns } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Extension, ExtensionContext } from 'shared';
import KanbanSwitch from './elements/KanbanSwitch.tsx';
import ViewToggle from './elements/ViewToggle.tsx';

class DevXcrafttmKanbanserversExtension extends Extension {
  public cardConfigurationPage: React.FC | null = null;
  public cardComponent: React.FC | null = null;
  public cardIcon: React.ReactNode = <FontAwesomeIcon icon={faTableColumns} />;

  public initialize(ctx: ExtensionContext): void {
    ctx.extensionRegistry.pages.dashboard.home.enterContainerGrouped((container) =>
      container.addPropsInterceptor((props) => ({
        ...props,
        contentRight: (
          <>
            {props.contentRight}
            <ViewToggle />
          </>
        ),
        children: <KanbanSwitch fallback={props.children} />,
      })),
    );
  }
}

export default new DevXcrafttmKanbanserversExtension();
