use shared::{
    State,
    extensions::{Extension, ExtensionRouteBuilder, settings::ExtensionSettingsDeserializer},
};
use std::sync::Arc;

mod routes;
pub mod settings;

pub const PACKAGE_NAME: &str = "dev.xcrafttm.kanbanservers";

// The board itself works on the core server group API; the backend only stores the admin settings
// (card gap, list stacking) and hands them to the board.
#[derive(Default)]
pub struct ExtensionStruct;

#[async_trait::async_trait]
impl Extension for ExtensionStruct {
    async fn initialize_router(
        &mut self,
        state: State,
        builder: ExtensionRouteBuilder,
    ) -> ExtensionRouteBuilder {
        builder
            .add_client_api_router(|router| {
                router.nest(
                    "/extensions/dev.xcrafttm.kanbanservers",
                    routes::client::router(&state),
                )
            })
            .add_admin_api_router(|router| {
                router.nest(
                    "/extensions/dev.xcrafttm.kanbanservers",
                    routes::admin::router(&state),
                )
            })
    }

    async fn settings_deserializer(&self, _state: State) -> ExtensionSettingsDeserializer {
        Arc::new(settings::KanbanSettingsDeserializer)
    }
}
