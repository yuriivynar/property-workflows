## MODIFIED Requirements

### Requirement: Порожній список запусків

WHEN менеджер або адміністратор, у якого немає жодного видимого запуску, відкриває список запусків, the system SHALL показати повідомлення «No runs yet. Launch a template to start one.» і посилання «Launch a template» замість порожньої таблиці.

#### Scenario: AC-DSYS-04 Менеджер без запусків бачить порожній стан

- **GIVEN** менеджер B, у якого немає запусків
- **WHEN** B відкриває список запусків
- **THEN** B бачить повідомлення «No runs yet. Launch a template to start one.» і посилання «Launch a template»
- **AND** порожньої таблиці немає
