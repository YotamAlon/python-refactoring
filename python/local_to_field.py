import sys

from rope.base.project import Project
from rope.base import libutils
from rope.refactor.localtofield import LocalToField

def main(project_path: str, resource_path: str, offset: int):
    myproject = Project(project_path)
    resource = libutils.path_to_resource(myproject, resource_path)
    myproject.validate(resource)

    local_to_field = LocalToField(myproject, resource, offset)
    changes = local_to_field.get_changes()

    print(changes.get_description())

    myproject.do(changes)

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], int(sys.argv[3]))