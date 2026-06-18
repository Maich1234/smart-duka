# Smart Duka 👋

Smart Duka is a mobile app for managing a shop's inventory, sales, and staff. It's built with [Expo](https://expo.dev) and [Expo Router](https://docs.expo.dev/router/introduction), and supports separate experiences for shop owners and staff.

## Features

- **Auth** — login, registration, email verification, and password recovery
- **Owner dashboard** — inventory, sales, staff management, and profile
- **Staff dashboard** — inventory and sales, scoped to staff permissions
- **Payments** — cash and M-Pesa
- **Low stock alerts** and paginated product/sales lists

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Project structure

- `app/` — routes, grouped into `(auth)`, `(owner)`, and `(staff)` segments
- `components/` — shared UI components
- `services/` — API clients (`auth`, `dashboard`, `products`, `sales`, `shop`, `staff`)
- `store/` — Zustand stores (e.g. `authStore`)
- `constants/` — app config, theme tokens (colors, spacing, typography, shadows)
- `context/`, `hooks/`, `utils/` — supporting app logic

The API base URL and other app-wide settings live in [constants/config.ts](constants/config.ts).

## Learn more

To learn more about developing with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.
