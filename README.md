# StressFreeChef

Stress-free cooking. Step by step.
Everything you need for cooking — all in one place.

## Links

Landing page: https://stressfreechef-landing.vercel.app/

Web App: https://www.stressfreechef.com/

Download Android APK (v1.0.0): https://github.com/ArthurNovember/stressfreechef/releases/tag/v1.0.0

LinkedIn: https://www.linkedin.com/in/mat%C4%9Bj-artur-nov%C3%A1%C4%8Dek-1212553a4/

GitHub repo: https://github.com/ArthurNovember/stressfreechef

## Why I Built This

I built StressFreeChef because most recipe apps felt incomplete to me. They only offer recipes — and for everything else (shopping list, timers, notes) you end up using extra apps. I wanted one place where the whole cooking workflow lives, so cooking stays calm and simple.

Another problem was the actual cooking experience. Using recipes on a phone is often impractical when your hands are messy — which is why StressFreeChef includes hands-free controls.

And finally: I love using AI to create recipes from ingredients I already have at home, but I was missing structure. I wanted a way to turn AI-generated text into a real recipe format and actually save it for later.

## Features

### Hands-Free Cooking

Use voice commands to navigate steps and control timers.

### AI Recipe Import

When creating custom recipes, you can enable AI mode. The app generates a prompt you can send to an external AI together with a recipe.
Paste the AI response back into StressFreeChef and the recipe is automatically converted into a structured format (ingredients, steps, timers, media).

### Smart Shopping List

Send ingredients directly from a recipe to your shopping list.
Each item can be assigned to a specific store and you can filter the list by store.

### Community Recipes

Browse community creations, save recipes, and get inspired — in a classic grid view or a swipe (“Tinder”) mode.

### Save & Favorites

Save recipes and keep frequently used items as favorites.

### Customization

Switch language between Czech and English, and choose between light/dark theme.

## Tech Stack

Mobile App: React Native (Expo) + TypeScript

Web App: React + TypeScript

Backend API: Node.js + Express

Database: MongoDB (Mongoose)

Auth: JWT

API: REST

## FAQ

### How does hands-free mode work?

Once enabled in settings, you can control recipes using voice commands (currently English only):
Next / Previous / Start timer / Pause timer / Reset timer

### Do I need an account?

Without an account, features are limited. Signing up enables saving recipes, creating your own recipes, syncing your shopping list across devices, and saving favorite shopping items.

## Local Development

### Clone repository

```bash
git clone https://github.com/ArthurNovember/stressfreechef.git
cd stressfreechef
```

### Install dependencies

```bash
npm install
```

The repository is organized as a multi-part project (web / mobile / backend).
Navigate to each folder to install and run it locally.

## Author

Matěj Artur Nováček

LinkedIn: https://www.linkedin.com/in/mat%C4%9Bj-artur-nov%C3%A1%C4%8Dek-1212553a4/
