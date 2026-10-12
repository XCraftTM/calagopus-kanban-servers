use shared::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod get {
    use shared::{
        GetState,
        response::{ApiResponse, ApiResponseResult},
    };

    use crate::settings::KanbanSettings;

    #[derive(utoipa::ToSchema, serde::Serialize)]
    struct Response<'a> {
        #[schema(inline)]
        config: &'a KanbanSettings,
    }

    /// The board settings every signed-in user's board needs; nothing in here is sensitive.
    #[utoipa::path(get, path = "/", responses((status = OK, body = inline(Response))))]
    pub async fn route(state: GetState) -> ApiResponseResult {
        let settings = state.settings.get().await?;
        let config: &KanbanSettings = settings.find_extension_settings()?;

        ApiResponse::new_serialized(Response { config }).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .nest(
            "/config",
            OpenApiRouter::new()
                .routes(routes!(get::route))
                .with_state(state.clone()),
        )
        .with_state(state.clone())
}
