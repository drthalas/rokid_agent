// Adapted from rokidhub-codex CodexCommandPlanner, MIT, Copyright (c) 2026 Azat Akhmetshin.
package local.rokid.codex

data class Command(val action: String, val text: String)
object CommandPlanner {
    fun plan(text: String): Command {
        val normalized = text.trim().lowercase().replace('ё', 'е').trimEnd('.', '!', '?')
        if (normalized in listOf("stop", "cancel", "останови", "стоп")) return Command("stop", "")
        if (normalized in listOf("new conversation", "новый диалог")) return Command("new", "")
        for (prefix in listOf("выбери проект ", "проект ", "select project ", "project ")) {
            if (normalized.startsWith(prefix)) return Command("project", normalized.removePrefix(prefix).trim())
        }
        if (normalized in listOf("summary", "краткий итог", "коротко что нашел"))
            return Command("prompt", "Кратко подведи итог этого диалога.")
        return Command("prompt", text.trim())
    }
}
