(function()
{
    /// Imported from other modules.
    let bookmarks, domanip;

    /// Invoked when transitioning out of this panel.
    let transition_to;

    /// A transition to the main menu.
    const MAIN_MENU_TRANSITION =
    {
        id: "main_menu",
        label: browser.i18n.getMessage("command_go_to_menu")
    };

    /// Contains DOM elements. Populated by initialize().
    const DOM =
    {
        lock_button: null,
        unlock_button: null,
        change_password_button: null
    };

    /// Disables all buttons.
    function disable_all_buttons()
    {
        for (const button of Object.values(DOM)) { domanip.disable(button, true); }
    }
    /// Gets the active main button.
    async function get_main_active_button()
    {
        if (await bookmarks.is_locked()) { return DOM.unlock_button; }
        else                             { return DOM.lock_button; }
    }
    /// Enables/disables buttons based on the bookmarks folder state.
    async function update_button_activation_status()
    {
        disable_all_buttons();

        domanip.enable(await get_main_active_button(), true);
        domanip.enable(DOM.change_password_button, true);
    }

    /// Invoked when the user chooses to lock his/her private bookmarks.
    async function lock()
    {
        if (await bookmarks.is_locked()) { return; }
        try
        {
            const locking = bookmarks.lock();
            transition_to("on_hold");
            await new Promise(resolve => { setTimeout(resolve, 1000); });
            await locking;
            transition_to("success",
                          {
                                details: browser.i18n.getMessage("success_lock"),
                                transition: MAIN_MENU_TRANSITION
                          });
        }
        catch (error)
        {
            transition_to("error",
            {
                title: "Error during lock",
                message: error.message
            });
        }
    }
    /// Invoked when the user chooses to unlock his/her private bookmarks.
    async function unlock()
    {
        if (await bookmarks.is_unlocked()) { return; }

        transition_to("authentication",
        {
            message: "",

            on_acceptance: async hashed_password =>
            {
                try
                {
                    const unlocking = bookmarks.unlock(hashed_password);
                    transition_to("on_hold", "unlock-status-update");
                    await new Promise(resolve => { setTimeout(resolve, 1000); });
                    await unlocking;

                    const title        = await bookmarks.get_front_title(),
                          parent_title = await bookmarks.get_front_parent_title();

                    transition_to("success",
                                  {
                                        details: browser.i18n.getMessage(
                                            "success_unlock",
                                            [title,
                                             parent_title === "" ? "(no title)" : parent_title]
                                        ),
                                        transition: MAIN_MENU_TRANSITION
                                  });
                }
                catch (error)
                {
                    transition_to("error",
                    {
                        title: "Error during unlock",
                        message: error.message
                    });
                }
            },
            on_cancellation: () => { transition_to("main_menu"); }
        });
    }

    /// Invoked when the user chooses to change his/her password.
    async function change_password()
    {
        if (await bookmarks.needs_setup()) { return; }

        transition_to("authentication",
        {
            message: browser.i18n.getMessage("direction_enter_current_password"),

            on_acceptance: async old_hashed_password =>
            {
                transition_to("password_setup",
                {
                    old_hashed_password: old_hashed_password,

                    on_success: () =>
                    {
                        transition_to("success",
                        {
                            details: browser.i18n.getMessage("success_password_change"),
                            transition: MAIN_MENU_TRANSITION
                        });
                    },
                    on_cancellation: () => { transition_to("main_menu"); }
                });
            },
            on_cancellation: () => { transition_to("main_menu"); }
        });
    }

    /// Invoked when this panel is activated.
    async function on_activate()
    {
        await update_button_activation_status();
        (await get_main_active_button()).focus();
    }
    /// Invoked when this panel is deactivated.
    function on_deactivate() { disable_all_buttons(); }

    /// Initializes this module.
    function initialize()
    {
        domanip.populate(DOM);

        DOM.lock_button.addEventListener("click", lock);
        DOM.unlock_button.addEventListener("click", unlock);
        DOM.change_password_button.addEventListener("click", change_password);
    }

    define(["scripts/foreground/bookmarks_interface",
            "scripts/utilities/dom_manipulation"],
           (bookmarks_module, dom_module) =>
           {
               bookmarks = bookmarks_module;
               domanip = dom_module;

               domanip.when_ready(initialize);

               return   {
                            ID: "main_menu",
                            TITLE: browser.i18n.getMessage("extension_name"),

                            on_activate:   on_activate,
                            on_deactivate: on_deactivate,
                            on_transition: handler => { transition_to = handler; }
                        };
           });
})();
