# Price-review navigation, 31 October 2026

The price-alerts route was automatically registered by Expo Router without a corresponding Tabs.Screen configuration. The owner navigator's default header therefore appeared above PriceAlertsScreen's own header, exposing the raw route name and two back buttons.

Register price-alerts explicitly with title Price review, href:null and headerShown:false, matching the other screens that draw their own header. Preserve the screen's accessible back action and inventory fallback, current tab behavior and the previously merged Inter/compact-card/detail redesign.

TypeScript and whitespace checks passed. Parsed the actual navigator TSX to verify exactly one price-alerts registration with the outer header suppressed, and confirmed one ScreenHeader in PriceAlertsScreen. This is configuration verification, not physical Android navigation testing. A fresh APK is required to see the merged UI redesign and this header fix; the existing installed APK does not acquire source changes automatically.
