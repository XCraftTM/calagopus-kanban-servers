use compact_str::ToCompactString;
use shared::extensions::settings::{
    ExtensionSettings, SettingsDeserializeExt, SettingsDeserializer, SettingsSerializeExt,
    SettingsSerializer,
};

pub const CARD_GAP_MIN: u32 = 0;
pub const CARD_GAP_MAX: u32 = 32;
pub const CARD_GAP_DEFAULT: u32 = 8;

#[derive(utoipa::ToSchema, serde::Serialize, serde::Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct KanbanSettings {
    /// Space between the cards of a list, in pixels.
    #[schema(minimum = 0, maximum = 32)]
    pub card_gap: u32,
    /// Whether users may stack lists on top of each other in one column.
    pub allow_list_stacking: bool,
}

impl Default for KanbanSettings {
    fn default() -> Self {
        Self {
            card_gap: CARD_GAP_DEFAULT,
            allow_list_stacking: false,
        }
    }
}

impl KanbanSettings {
    /// Field-prefixed messages, so the settings page can attach them to its inputs.
    pub fn validate(&self) -> Vec<String> {
        let mut errors = Vec::new();

        if !(CARD_GAP_MIN..=CARD_GAP_MAX).contains(&self.card_gap) {
            errors.push(format!(
                "card_gap: must be between {CARD_GAP_MIN} and {CARD_GAP_MAX}"
            ));
        }

        errors
    }

    /// Repairs values that came from hand-edited or older settings rows.
    pub fn normalize(&mut self) {
        self.card_gap = self.card_gap.clamp(CARD_GAP_MIN, CARD_GAP_MAX);
    }
}

#[async_trait::async_trait]
impl SettingsSerializeExt for KanbanSettings {
    async fn serialize(
        &self,
        serializer: SettingsSerializer,
    ) -> Result<SettingsSerializer, anyhow::Error> {
        Ok(serializer
            .write_raw_setting("card_gap", self.card_gap.to_compact_string())
            .write_raw_setting(
                "allow_list_stacking",
                self.allow_list_stacking.to_compact_string(),
            ))
    }
}

pub struct KanbanSettingsDeserializer;

#[async_trait::async_trait]
impl SettingsDeserializeExt for KanbanSettingsDeserializer {
    async fn deserialize_boxed(
        &self,
        mut deserializer: SettingsDeserializer<'_>,
    ) -> Result<ExtensionSettings, anyhow::Error> {
        let defaults = KanbanSettings::default();

        // missing keys (fresh installs, upgrades from 1.1.x) and garbage fall back to the defaults
        let mut settings = KanbanSettings {
            card_gap: deserializer
                .take_raw_setting("card_gap")
                .and_then(|value| value.parse().ok())
                .unwrap_or(defaults.card_gap),
            allow_list_stacking: deserializer
                .take_raw_setting("allow_list_stacking")
                .and_then(|value| value.parse().ok())
                .unwrap_or(defaults.allow_list_stacking),
        };
        settings.normalize();

        Ok(Box::new(settings))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn defaults_are_valid() {
        assert!(KanbanSettings::default().validate().is_empty());
        assert_eq!(KanbanSettings::default().card_gap, 8);
        assert!(!KanbanSettings::default().allow_list_stacking);
    }

    #[test]
    fn rejects_gap_out_of_range() {
        let settings = KanbanSettings {
            card_gap: CARD_GAP_MAX + 1,
            ..Default::default()
        };
        assert_eq!(settings.validate().len(), 1);
        assert!(settings.validate()[0].starts_with("card_gap:"));
    }

    #[test]
    fn normalize_clamps_gap() {
        let mut settings = KanbanSettings {
            card_gap: 500,
            ..Default::default()
        };
        settings.normalize();
        assert_eq!(settings.card_gap, CARD_GAP_MAX);
    }
}
