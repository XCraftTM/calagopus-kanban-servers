use shared::extensions::Extension;

// The board is frontend-only: it reuses the core server group API
// (`/api/client/servers/groups/...`), so the backend has nothing to register.
#[derive(Default)]
pub struct ExtensionStruct;

#[async_trait::async_trait]
impl Extension for ExtensionStruct {}
