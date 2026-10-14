"""Deterministic checks for shared 15-second image readiness."""
import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location("display_ready", Path(__file__).resolve().parents[1] / "deploy/display_ready.py")
ready = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ready)


class TrainingTests(unittest.TestCase):
    def setUp(self):
        ready.states.clear()
        self.now = 1800000000.
        self.slot = int(self.now // 60)

    def test_image_required_and_fifteen_seconds(self):
        self.assertEqual(ready.readiness(self.slot, "neighbour:r1", now=self.now), {"ready": False})
        self.assertEqual(ready.readiness(self.slot, "neighbour:r1", True, self.now)["remaining_ms"], 15000)
        self.assertGreater(ready.readiness(self.slot, "neighbour:r1", now=self.now+14.999)["remaining_ms"], 0)
        self.assertEqual(ready.readiness(self.slot, "neighbour:r1", now=self.now+15)["remaining_ms"], 0)

    def test_reload_does_not_restart_timer(self):
        ready.readiness(self.slot, "neighbour:r1", True, self.now)
        self.assertEqual(ready.readiness(self.slot, "neighbour:r1", True, self.now+10)["remaining_ms"], 5000)

    def test_image_mode_and_slot_isolation(self):
        ready.readiness(self.slot, "neighbour:r1", True, self.now)
        for slot, key in [(self.slot, "neighbour:r2"), (self.slot, "random:r1"), (self.slot+1, "neighbour:r1")]:
            self.assertEqual(ready.readiness(slot, key, now=self.now), {"ready": False})

    def test_invalid_and_expired_requests(self):
        with self.assertRaises(ValueError):
            ready.readiness(self.slot, "invalid", now=self.now)
        with self.assertRaises(ValueError):
            ready.readiness(self.slot-2, "neighbour:r1", now=self.now)


if __name__ == "__main__":
    unittest.main()
