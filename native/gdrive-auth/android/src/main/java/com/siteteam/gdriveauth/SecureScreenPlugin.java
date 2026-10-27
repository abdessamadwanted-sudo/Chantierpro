package com.siteteam.gdriveauth;

import android.view.WindowManager;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * SiteTeam : anti-capture d'écran (FLAG_SECURE) — empêche les captures et l'enregistrement de l'écran,
 * et masque l'aperçu de l'application dans la liste des applications récentes.
 * Activé par le responsable de l'organisation (ou imposé par le Super Admin).
 */
@CapacitorPlugin(name = "SecureScreen")
public class SecureScreenPlugin extends Plugin {
    @PluginMethod
    public void set(PluginCall call) {
        final boolean on = call.getBoolean("on", false);
        getActivity().runOnUiThread(() -> {
            if (on) getActivity().getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
            else getActivity().getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SECURE);
            call.resolve();
        });
    }
}
