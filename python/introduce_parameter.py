import sys

from rope.base.project import Project
from rope.base import libutils
from rope.refactor.introduce_parameter import IntroduceParameter


def main(project_path: str, resource_path: str, offset: int, parameter_name: str):

    myproject = Project(project_path)
    resource = libutils.path_to_resource(myproject, resource_path)
    myproject.validate(resource)

    introduce_parameter = IntroduceParameter(myproject, resource, offset)
    changes = introduce_parameter.get_changes(parameter_name)

    print(changes.get_description())

    myproject.do(changes)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], int(sys.argv[3]), sys.argv[4])
