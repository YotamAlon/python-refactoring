import json
import os
import pathlib
import sys
import traceback

BUNDLE_DIR = pathlib.Path(__file__).parent.parent / "bundled"

sys.path.insert(0, os.fspath(BUNDLE_DIR))

from rope.base.project import Project
from rope.base import libutils
from rope.refactor.inline import create_inline
from rope.refactor.introduce_parameter import IntroduceParameter

refactorings = {
    "inline": lambda *args: create_inline(*args).get_changes(),
    "introduce_parameter": lambda *args: IntroduceParameter(*args).get_changes("new_param"),
}


def main(project_path: str, configuration: dict) -> None:
    ignored_resources = configuration['ignored_resources']
    source_folders = configuration['ignored_resources']

    prefs = {'ignored_resources': ignored_resources}
    if source_folders:
        prefs['source_folders'] = source_folders
        
    myproject = Project(project_path, **prefs)
    libutils.analyze_modules(myproject)
    input()
    print(json.dumps({"message": "ready"}))
    while True:
        [file, offset] = json.loads(input())
        resource = libutils.path_to_resource(myproject, file)
        output = []
        for name, refactor in refactorings.items():
            try:
                changeset = refactor(myproject, resource, offset)
            except Exception:
                traceback.print_exc()
            else:
                changed_files = []
                for change in changeset.changes:
                    changed_files.append(
                        {
                            "path": change.resource.real_path,
                            "new_contents": change.new_contents,
                        }
                    )

                output.append({"type": name, "changed_files": changed_files})

        json.dump(output, sys.stdout)


if __name__ == "__main__":
    main(sys.argv[1], json.loads(sys.argv[2]))
