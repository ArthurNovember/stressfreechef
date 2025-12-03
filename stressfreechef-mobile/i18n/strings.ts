// app/i18n/strings.ts
export type Lang = "en" | "cs";

export const LANG_KEY = "app_lang";

const STRINGS = {
  settings: {
    loading: {
      en: "Loading settings…",
      cs: "Načítám nastavení…",
    },
    headerTitle: {
      en: "Settings",
      cs: "Nastavení",
    },
    themeTitle: {
      en: "Theme",
      cs: "Vzhled",
    },
    themeDark: {
      en: "Dark",
      cs: "Tmavý",
    },
    themeLight: {
      en: "Light",
      cs: "Světlý",
    },

    langTitle: {
      en: "Language",
      cs: "Jazyk",
    },

    dangerTitle: {
      en: "Danger zone",
      cs: "Nebezpečná zóna",
    },
    dangerHelper: {
      en: "This will permanently delete your account.",
      cs: "Tímto trvale smažete svůj účet.",
    },
    deleteBtn: {
      en: "Delete account",
      cs: "Smazat účet",
    },
    confirmDeleteTitle: {
      en: "Delete account",
      cs: "Smazat účet",
    },
    confirmDeleteMessage: {
      en: "This will permanently delete your account, recipes, shopping list and favorites. This action cannot be undone.",
      cs: "Tímto trvale smažete svůj účet, recepty, nákupní seznam a oblíbené položky. Tuto akci nelze vrátit.",
    },
    confirmCancel: {
      en: "Cancel",
      cs: "Zrušit",
    },
    confirmDelete: {
      en: "Delete",
      cs: "Smazat",
    },
    notLoggedInTitle: {
      en: "Not logged in",
      cs: "Nejste přihlášen",
    },
    notLoggedInMsg: {
      en: "You must be logged in to delete account.",
      cs: "Pro smazání účtu se musíte přihlásit.",
    },
    deletedTitle: {
      en: "Account deleted",
      cs: "Účet smazán",
    },
    deletedMsg: {
      en: "Your account has been deleted.",
      cs: "Váš účet byl smazán.",
    },
    deleteFailedTitle: {
      en: "Account deletion failed",
      cs: "Smazání účtu se nezdařilo",
    },
  },
  home: {
    loadingRecipes: {
      en: "Loading recipes…",
      cs: "Načítám recepty…",
    },
    newest: { en: "NEWEST", cs: "NEJNOVĚJŠÍ" },
    easiest: { en: "EASIEST", cs: "NEJLEHČÍ" },
    favorite: { en: "FAVORITE", cs: "OBLÍBENÉ" },
    random: { en: "RANDOM", cs: "NÁHODNĚ" },

    difficulty: { en: "Difficulty", cs: "Obtížnost" },
    time: { en: "Time", cs: "Čas" },
    ingredients: { en: "Ingredients", cs: "Ingredience" },

    save: { en: "Save", cs: "Uložit" },
    saved: { en: "Saved", cs: "Uloženo" },

    getStarted: { en: "GET STARTED", cs: "Začít vařit" },
    close: { en: "Close", cs: "Zavřít" },

    loginRequiredTitle: {
      en: "Login required",
      cs: "Vyžadováno přihlášení",
    },
    loginRequiredMsg: {
      en: "Please log in to save recipes.",
      cs: "Pro ukládání receptů se prosím přihlaste.",
    },

    addFailedTitle: {
      en: "Failed to add",
      cs: "Nepodařilo se přidat",
    },
  },
  recipe: {
    stepsUnavailable: {
      en: "Recipe steps not available.",
      cs: "Kroky receptu nejsou dostupné.",
    },
    back: {
      en: "Back",
      cs: "Zpět",
    },
    step: {
      en: "Step",
      cs: "Krok",
    },
    of: {
      en: "of",
      cs: "z",
    },
    timerDone: {
      en: "Timer completed ✔",
      cs: "Timer dokončen ✔",
    },
    completed: {
      en: "RECIPE COMPLETED",
      cs: "RECEPT DOKONČEN",
    },
    rateThis: {
      en: "Rate this recipe:",
      cs: "Ohodnoťte tento recept:",
    },
    ratingNotAvailable: {
      en: "Rating not available for this recipe.",
      cs: "Hodnocení není k dispozici.",
    },
    loginRequired: {
      en: "You must be logged in to rate.",
      cs: "Pro hodnocení je nutné být přihlášen.",
    },
    ratingFailed: {
      en: "Rating failed.",
      cs: "Hodnocení se nepodařilo odeslat.",
    },
    ratingThanks: {
      en: "Thanks!",
      cs: "Děkujeme!",
    },
    cannotRate: {
      en: "This recipe cannot be rated.",
      cs: "Tento recept nelze hodnotit.",
    },
    preparing: {
      en: "Preparing rating…",
      cs: "Připravuji hodnocení…",
    },
    previous: {
      en: "PREVIOUS",
      cs: "PŘEDCHOZÍ",
    },
    next: {
      en: "NEXT STEP",
      cs: "DALŠÍ KROK",
    },
    finish: {
      en: "FINISH",
      cs: "DOKONČIT",
    },
  },
  explore: {
    title: {
      en: "EXPLORE RECIPES",
      cs: "OBJEVTE RECPETY",
    },
    grid: {
      en: "GRID",
      cs: "MŘÍŽKA",
    },
    swipe: {
      en: "SWIPE",
      cs: "SWIPE",
    },
    searchPlaceholder: {
      en: "Search recipes…",
      cs: "Hledat recepty…",
    },
    loading: {
      en: "Loading recipes…",
      cs: "Načítám recepty…",
    },
    empty: {
      en: "No results found. Try a different keyword.",
      cs: "Nic nenalezeno. Zkuste jiné klíčové slovo.",
    },
    loadingMore: {
      en: "Loading more…",
      cs: "Načítám další…",
    },
    noSwipe: {
      en: "No recipes to swipe.",
      cs: "Žádné recepty ke swipování.",
    },
    noMoreSwipe: {
      en: "No more new recipes to swipe.",
      cs: "Žádné další nové recepty ke swipování.",
    },
    loadingMoreSwipe: {
      en: "Loading more recipes…",
      cs: "Načítám další recepty…",
    },
    newest: {
      en: "NEWEST",
      cs: "NEJNOVĚJŠÍ",
    },
    easiest: {
      en: "EASIEST",
      cs: "NEJSNADNĚJŠÍ",
    },
    favorite: {
      en: "FAVORITE",
      cs: "OBLÍBENÉ",
    },
    random: {
      en: "RANDOM",
      cs: "NÁHODNÉ",
    },
    ingredients: {
      en: "Ingredients",
      cs: "Ingredience",
    },
    getStarted: {
      en: "GET STARTED",
      cs: "ZAČÍT VAŘIT",
    },
    close: {
      en: "CLOSE",
      cs: "ZAVŘÍT",
    },
    skip: {
      en: "Skip",
      cs: "Přeskočit",
    },
    save: {
      en: "Save ❤️",
      cs: "Uložit ❤️",
    },
    savedToFavorites: {
      en: "Saved to favorites",
      cs: "Uloženo do oblíbených",
    },
  },
  profile: {
    authSignUp: { en: "SIGN UP", cs: "REGISTRACE" },
    authLogin: { en: "LOG IN", cs: "PŘIHLÁSIT SE" },
    username: { en: "Username", cs: "Uživatelské jméno" },
    email: { en: "Email", cs: "E-mail" },
    password: { en: "Password", cs: "Heslo" },
    confirmPassword: { en: "Confirm password", cs: "Potvrzení hesla" },

    passwordsDontMatch: {
      en: "Passwords do not match.",
      cs: "Hesla se neshodují.",
    },
    registrationSuccessfulTitle: {
      en: "Registration successful",
      cs: "Registrace proběhla úspěšně",
    },
    registrationSuccessfulMsg: {
      en: "You can log in now.",
      cs: "Nyní se můžete přihlásit.",
    },
    registrationFailedTitle: {
      en: "Registration failed",
      cs: "Registrace se nezdařila.",
    },
    loginSuccessfulTitle: {
      en: "Login successful",
      cs: "Přihlášení proběhlo úspěšně.",
    },
    loginFailedTitle: {
      en: "Login failed",
      cs: "Přihlášení se nezdařilo.",
    },
    pleaseWait: { en: "Please wait…", cs: "Prosím čekejte…" },

    loading: { en: "Loading…", cs: "Načítám…" },
    errorPrefix: { en: "Error", cs: "Chyba" },
    retry: { en: "Retry", cs: "Zkusit znovu" },
    logout: { en: "Logout", cs: "Odhlásit se" },

    savedRecipesTitle: { en: "SAVED RECIPES", cs: "ULOŽENÉ RECEPTY" },
    savedEmpty: {
      en: "You haven’t saved any community recipes yet.",
      cs: "Zatím jste si neuložili žádné komunitní recepty.",
    },
    myRecipesTitle: { en: "MY RECIPES", cs: "MOJE RECEPTY" },
    myEmpty: {
      en: "You don’t have any recipes yet. Add your first one!",
      cs: "Ještě nemáte žádné recepty. Přidejte svůj první!",
    },

    deleteRecipeTitle: { en: "Delete recipe?", cs: "Smazat recept?" },
    deleteRecipeMsg: {
      en: "This cannot be undone.",
      cs: "Tuto akci nelze vrátit zpět.",
    },
    removeSavedTitle: {
      en: "Remove saved recipe?",
      cs: "Odebrat uložený recept?",
    },
    cancel: { en: "Cancel", cs: "Zrušit" },
    delete: { en: "Delete", cs: "Smazat" },
    remove: { en: "Remove", cs: "Odebrat" },
    removeFailedTitle: {
      en: "Failed to remove",
      cs: "Odebrání se nezdařilo.",
    },

    ingredients: { en: "Ingredients", cs: "Ingredience" },
    getStarted: { en: "GET STARTED", cs: "ZAČÍT VAŘIT" },
    close: { en: "Close", cs: "Zavřít" },

    addedTitle: { en: "Added", cs: "Přidáno" },
  },
  shopping: {
    loading: {
      en: "Loading shopping list…",
      cs: "Načítám nákupní seznam…",
    },
    retry: {
      en: "Retry",
      cs: "Zkusit znovu",
    },
    addNewItemTitle: {
      en: "Add new item",
      cs: "Přidat položku",
    },
    addItemPlaceholder: {
      en: "Add item…",
      cs: "Přidejte položku…",
    },
    shopsForItem: {
      en: "Shops for this item:",
      cs: "Obchody pro tuto položku:",
    },
    manageShops: {
      en: "Manage shops",
      cs: "Spravovat obchody",
    },
    addShops: {
      en: "Add shops",
      cs: "Přidat obchody",
    },
    sendToList: {
      en: "Send to list",
      cs: "Přidat do seznamu",
    },
    filterByShop: {
      en: "Filter by shop:",
      cs: "Filtrovat podle obchodu:",
    },
    all: {
      en: "All",
      cs: "Vše",
    },
    noShop: {
      en: "No shop",
      cs: "Bez obchodu",
    },

    // Modaly
    itemFallback: {
      en: "Item",
      cs: "Položka",
    },
    shopsTitle: {
      en: "Shops",
      cs: "Obchody",
    },
    addNewShopLabel: {
      en: "Add new shop",
      cs: "Přidat nový obchod",
    },
    newShopPlaceholder: {
      en: "New shop name",
      cs: "Název nového obchodu",
    },
    close: {
      en: "Close",
      cs: "Zavřít",
    },
    manageShopsTitle: {
      en: "Manage shops",
      cs: "Spravovat obchody",
    },
    noShopsYet: {
      en: "No shops yet.",
      cs: "Zatím žádné obchody.",
    },

    // Alerty
    loginRequiredFavoritesTitle: {
      en: "Login required",
      cs: "Je nutné přihlášení",
    },
    loginRequiredFavoritesMsg: {
      en: "Log in to access your favorite items.",
      cs: "Přihlaste se, abyste mohli používat oblíbené položky.",
    },
    loginRequiredStoresMsg: {
      en: "Log in to unlock store assignment.",
      cs: "Přihlaste se, abyste mohli přiřazovat obchody.",
    },
    shopAlreadyExists: {
      en: "Shop already exists",
      cs: "Tento obchod už existuje.",
    },
    failedAddItem: {
      en: "Failed to add item",
      cs: "Nepodařilo se přidat položku",
    },
    updateFailed: {
      en: "Update failed",
      cs: "Aktualizace se nezdařila",
    },
    failedAddShop: {
      en: "Failed to add shop",
      cs: "Nepodařilo se přidat obchod",
    },
    deleteShopTitle: {
      en: "Delete shop",
      cs: "Smazat obchod",
    },
    deleteShopMsg: {
      en: "This will remove this shop from all items. Continue?",
      cs: "Tento obchod bude odebrán ze všech položek. Pokračovat?",
    },
    cancel: {
      en: "Cancel",
      cs: "Zrušit",
    },
    delete: {
      en: "Delete",
      cs: "Smazat",
    },
    failedDeleteShop: {
      en: "Failed to delete shop",
      cs: "Nepodařilo se smazat obchod",
    },
    failedAddFavorite: {
      en: "Failed to add favorite",
      cs: "Nepodařilo se přidat oblíbenou položku",
    },
    failedUpdateFavorites: {
      en: "Failed to update favorites",
      cs: "Nepodařilo se upravit oblíbené položky",
    },
    sessionExpired: {
      en: "Your session has expired. Please log in again on MyProfile.",
      cs: "Platnost přihlášení vypršela. Přihlaste se znovu v záložce Můj Profil.",
    },
  },
  favorites: {
    loading: {
      en: "Loading favorites…",
      cs: "Načítám oblíbené položky…",
    },
    backToShopping: {
      en: "← Back to shopping list",
      cs: "← Zpět na nákupní seznam",
    },
    addFavoriteTitle: {
      en: "Add favorite item",
      cs: "Přidat oblíbenou položku",
    },
    addFavoritePlaceholder: {
      en: "Add favorite item…",
      cs: "Přidat oblíbenou položku…",
    },
    saving: {
      en: "Saving…",
      cs: "Ukládám…",
    },
    addFavoriteBtn: {
      en: "Add favorite",
      cs: "Přidat oblíbenou",
    },
    addedToShoppingTitle: {
      en: "Added",
      cs: "Přidáno",
    },
    addedToShoppingMsg: {
      en: "Item was added to your shopping list.",
      cs: "Položka byla přidána do nákupního seznamu.",
    },
  },
  newRecipe: {
    nameLabel: {
      en: "Name of the Recipe",
      cs: "Název receptu",
    },
    titlePlaceholder: {
      en: "Title",
      cs: "Název",
    },
    difficultyLabel: {
      en: "Difficulty",
      cs: "Obtížnost",
    },
    timeLabel: {
      en: "Time",
      cs: "Čas",
    },
    timePlaceholder: {
      en: 'e.g. "00:20" or "20 min"',
      cs: 'např. "00:20" nebo "20 min"',
    },
    publicLabel: {
      en: "Public",
      cs: "Veřejný",
    },
    thumbTitle: {
      en: "Recipe Thumbnail",
      cs: "Náhledový obrázek",
    },
    thumbTapSelect: {
      en: "Tap to select image or video",
      cs: "Klepněte pro výběr obrázku nebo videa",
    },
    thumbVideoSelected: {
      en: "Video selected (thumbnail)",
      cs: "Vybráno video (náhled)",
    },
    stepsTitle: {
      en: "Steps",
      cs: "Kroky",
    },
    stepLabelPrefix: {
      en: "Step",
      cs: "Krok",
    },
    stepDescribePlaceholder: {
      en: "Describe the step…",
      cs: "Popište krok…",
    },
    stepMediaPlaceholder: {
      en: "Tap to select step image / video",
      cs: "Klepněte pro výběr obrázku / videa kroku",
    },
    stepVideoSelected: {
      en: "Video selected",
      cs: "Vybráno video",
    },
    timerLabel: {
      en: "Timer (optional, mm:ss or seconds)",
      cs: "Časovač (volitelné, mm:ss nebo sekundy)",
    },
    timerPlaceholder: {
      en: "e.g. 30 or 00:30",
      cs: "např. 30 nebo 00:30",
    },
    addStepBtn: {
      en: "+ Add Step",
      cs: "+ Přidat krok",
    },
    ingredientsTitle: {
      en: "Ingredients",
      cs: "Ingredience",
    },
    ingredientPlaceholder: {
      en: "e.g. chicken breast",
      cs: "např. kuřecí prsa",
    },
    addIngredientBtn: {
      en: "+ Add Ingredient",
      cs: "+ Přidat ingredienci",
    },
    createBtn: {
      en: "Create Recipe",
      cs: "Vytvořit recept",
    },
    errorFillMainFields: {
      en: "Fill in Title, Difficulty and Time.",
      cs: "Vyplňte název, obtížnost a čas.",
    },
    errorNoStep: {
      en: "Add at least one step description.",
      cs: "Přidejte alespoň jeden krok s popisem.",
    },
    notLoggedInTitle: {
      en: "Not logged in",
      cs: "Nepřihlášen",
    },
    notLoggedInMsg: {
      en: "Log in on MyProfile first.",
      cs: "Nejprve se přihlaste v záložce MyProfile.",
    },
    saveFailed: {
      en: "Save failed.",
      cs: "Uložení se nezdařilo.",
    },
    recipeCreated: {
      en: "Recipe created.",
      cs: "Recept byl vytvořen.",
    },
    recipeCreatedPublic: {
      en: "Recipe created and shared publicly.",
      cs: "Recept byl vytvořen a zveřejněn.",
    },
  },
  tabs: {
    home: {
      en: "Home",
      cs: "Domů",
    },
    community: {
      en: "Community",
      cs: "Komunita",
    },
    addRecipe: {
      en: "Add Recipe",
      cs: "Přidat recept",
    },
    shopping: {
      en: "Shopping list",
      cs: "Nákupní seznam",
    },
    profile: {
      en: "Profile",
      cs: "Profil",
    },
  },
} as const;

type Section = keyof typeof STRINGS;
type Key<S extends Section> = keyof (typeof STRINGS)[S];

export function t<S extends Section, K extends Key<S>>(
  lang: Lang,
  section: S,
  key: K
): string {
  const entry = STRINGS[section][key] as { en: string; cs: string };
  return entry[lang] ?? entry.en;
}
