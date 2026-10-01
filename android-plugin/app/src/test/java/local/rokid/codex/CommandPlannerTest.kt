package local.rokid.codex
import org.junit.Assert.assertEquals
import org.junit.Test
class CommandPlannerTest {
    @Test fun followupKeepsPrompt() { assertEquals(Command("prompt", "А теперь найди TODO"), CommandPlanner.plan("А теперь найди TODO")) }
    @Test fun controlsAreExplicit() {
        assertEquals("stop", CommandPlanner.plan("останови!").action)
        assertEquals("prompt", CommandPlanner.plan("не останови сборку").action)
        assertEquals(Command("project", "demo"), CommandPlanner.plan("выбери проект demo"))
        assertEquals("new", CommandPlanner.plan("новый диалог").action)
    }
}
