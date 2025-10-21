import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideQueryClient } from '@tanstack/angular-query-experimental';
import { QueryClient } from '@tanstack/angular-query-experimental';
import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { getFunctions, provideFunctions, connectFunctionsEmulator } from '@angular/fire/functions';
import { appRoutes } from './app.routes';

const firebaseConfig = {
  apiKey: 'demo-key',
  authDomain: 'demo-project.firebaseapp.com',
  projectId: 'demo-no-project',
  storageBucket: 'demo-project.firebasestorage.app',
  messagingSenderId: '123456789',
  appId: '1:123456789:web:demo',
};

const queryClient = new QueryClient({});

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(appRoutes),
    provideHttpClient(),
    provideQueryClient(queryClient),
    provideFirebaseApp(() => initializeApp(firebaseConfig)),
    provideFunctions(() => {
      const functions = getFunctions(undefined, 'us-central1');
      // Connect to local emulator in development
      if (typeof window !== 'undefined' && 
          (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
        connectFunctionsEmulator(functions, 'localhost', 5001);
      }
      return functions;
    }),
  ],
};
