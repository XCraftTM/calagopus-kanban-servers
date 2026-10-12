use shared::State;
use utoipa_axum::{router::OpenApiRouter, routes};

mod get {
    use shared::{
        GetState,
        models::user::GetPermissionManager,
        response::{ApiResponse, ApiResponseResult},
    };

    use crate::settings::KanbanSettings;

    #[derive(utoipa::ToSchema, serde::Serialize)]
    struct Response<'a> {
        #[schema(inline)]
        settings: &'a KanbanSettings,
    }

    #[utoipa::path(get, path = "/", responses((status = OK, body = inline(Response))))]
    pub async fn route(state: GetState, permissions: GetPermissionManager) -> ApiResponseResult {
        permissions.has_admin_permission("extensions.read")?;

        let settings = state.settings.get().await?;
        let settings: &KanbanSettings = settings.find_extension_settings()?;

        ApiResponse::new_serialized(Response { settings }).ok()
    }
}

mod put {
    use shared::{
        GetState,
        models::{admin_activity::GetAdminActivityLogger, user::GetPermissionManager},
        response::{ApiResponse, ApiResponseResult},
    };

    use crate::{PACKAGE_NAME, settings::KanbanSettings};

    #[derive(utoipa::ToSchema, serde::Serialize)]
    struct Response {
        #[schema(inline)]
        settings: KanbanSettings,
    }

    #[utoipa::path(
        put,
        path = "/",
        responses((status = OK, body = inline(Response))),
        request_body = inline(KanbanSettings)
    )]
    pub async fn route(
        state: GetState,
        permissions: GetPermissionManager,
        activity_logger: GetAdminActivityLogger,
        shared::Payload(mut data): shared::Payload<KanbanSettings>,
    ) -> ApiResponseResult {
        let errors = data.validate();
        if !errors.is_empty() {
            return ApiResponse::errors(errors).ok();
        }

        permissions.has_admin_permission("extensions.manage")?;
        data.normalize();

        let mut settings = state.settings.get_mut().await?;
        let current: &mut KanbanSettings = settings.find_mut_extension_settings()?;
        let previous = current.clone();
        *current = data.clone();
        settings.save().await?;

        activity_logger
            .log(
                "settings:extensions:update",
                serde_json::json!({
                    "extension": PACKAGE_NAME,
                    "card_gap": [previous.card_gap, data.card_gap],
                    "allow_list_stacking": [previous.allow_list_stacking, data.allow_list_stacking],
                }),
            )
            .await;

        ApiResponse::new_serialized(Response { settings: data }).ok()
    }
}

pub fn router(state: &State) -> OpenApiRouter<State> {
    OpenApiRouter::new()
        .nest(
            "/settings",
            OpenApiRouter::new()
                .routes(routes!(get::route))
                .routes(routes!(put::route))
                .with_state(state.clone()),
        )
        .with_state(state.clone())
}
